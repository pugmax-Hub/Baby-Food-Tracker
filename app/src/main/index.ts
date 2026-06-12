import { app, shell, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDatabase, getDatabase } from './db'
import { importExcelData } from './importer'
import path from 'path'
import fs from 'fs'
import os from 'os'
import http from 'http'
import multer from 'multer'
import QRCode from 'qrcode'

// Register custom protocol scheme
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true, stream: true } }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Handle media:// protocol to serve local attachments securely
  protocol.handle('media', (request) => {
    try {
      const urlPath = decodeURIComponent(request.url.replace('media://', ''))
      const userDataDir = app.getPath('userData')
      const filePath = path.join(userDataDir, 'attachments', urlPath)
      
      const attachmentsDir = path.join(userDataDir, 'attachments')
      if (!filePath.startsWith(attachmentsDir)) {
        return new Response('Access Denied', { status: 403 })
      }

      if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 })
      }

      const fileBuffer = fs.readFileSync(filePath)
      return new Response(fileBuffer)
    } catch (err) {
      console.error('Protocol media error:', err)
      return new Response('Internal Error', { status: 500 })
    }
  })

  // Initialize SQLite Database on Startup
  try {
    initDatabase()
    console.log('[Main] SQLite Database initialized successfully.')
  } catch (error) {
    console.error('[Main] Failed to initialize SQLite Database:', error)
  }

  // Setup IPC Handlers
  setupIpcHandlers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function setupIpcHandlers(): void {
  // 1. Get Patients List with optional search parameters
  ipcMain.handle('get-patients', async (_, filters?: { name?: string; status?: string; keyword?: string }) => {
    try {
      const db = getDatabase()
      let query = `
        SELECT p.*, r.next_handoff 
        FROM patients p 
        LEFT JOIN (
          SELECT patient_id, next_handoff 
          FROM records 
          WHERE id IN (SELECT MAX(id) FROM records GROUP BY patient_id)
        ) r ON p.id = r.patient_id
        WHERE 1=1
      `
      const params: any[] = []

      if (filters) {
        if (filters.name) {
          query += ' AND p.name LIKE ?'
          params.push(`%${filters.name}%`)
        }
        if (filters.status) {
          query += ' AND p.current_status LIKE ?'
          params.push(`%${filters.status}%`)
        }
        if (filters.keyword) {
          query += ' AND (p.chief_complaint LIKE ? OR p.current_status LIKE ?)'
          params.push(`%${filters.keyword}%`, `%${filters.keyword}%`)
        }
      }

      // Sort by last intervention or creation date
      query += ' ORDER BY p.id DESC'

      const stmt = db.prepare(query)
      return stmt.all(...params)
    } catch (error) {
      console.error('[IPC] get-patients error:', error)
      throw error
    }
  })

  // 2. Get Patient detail with records and checksheet items
  ipcMain.handle('get-patient-detail', async (_, patientId: number) => {
    try {
      const db = getDatabase()
      
      // Fetch patient profile
      const patientStmt = db.prepare('SELECT * FROM patients WHERE id = ?')
      const patient = patientStmt.get(patientId)
      if (!patient) return null

      // Fetch all records for this patient
      const recordsStmt = db.prepare('SELECT * FROM records WHERE patient_id = ? ORDER BY visit_count ASC')
      const records = recordsStmt.all(patientId) as any[]

      // For each record, fetch checksheet items and attachments
      const itemsStmt = db.prepare('SELECT item_key, item_label, value, note FROM checksheet_items WHERE record_id = ?')
      const attachStmt = db.prepare('SELECT * FROM record_attachments WHERE record_id = ? AND deleted_at IS NULL')
      
      for (const record of records) {
        const items = itemsStmt.all(record.id) as any[]
        record.checksheet = {}
        for (const item of items) {
          record.checksheet[item.item_key] = {
            value: item.value,
            note: item.note,
            label: item.item_label
          }
        }
        
        record.attachments = attachStmt.all(record.id) as any[]
      }

      return {
        patient,
        records
      }
    } catch (error) {
      console.error('[IPC] get-patient-detail error:', error)
      throw error
    }
  })

  // 3. Save / Update Patient Profile
  ipcMain.handle('save-patient', async (_, patient: any) => {
    try {
      const db = getDatabase()
      const nowStr = new Date().toISOString()

      if (patient.id) {
        // Update
        const stmt = db.prepare(`
          UPDATE patients SET
            patient_no = ?, name = ?, gender = ?, birth_date = ?,
            age_label = ?, age_years = ?, age_months = ?,
            first_visit_date = ?, last_visit_date = ?, last_visit_count = ?,
            current_status = ?, chief_complaint = ?, birth_weight = ?,
            delivery_method = ?, memo = ?, updated_at = ?
          WHERE id = ?
        `)
        stmt.run(
          patient.patient_no, patient.name, patient.gender, patient.birth_date,
          patient.age_label, patient.age_years, patient.age_months,
          patient.first_visit_date, patient.last_visit_date, patient.last_visit_count,
          patient.current_status, patient.chief_complaint, patient.birth_weight,
          patient.delivery_method, patient.memo || null, nowStr, patient.id
        )
        return { ...patient, updated_at: nowStr }
      } else {
        // Insert
        const stmt = db.prepare(`
          INSERT INTO patients (
            patient_no, name, gender, birth_date, age_label, age_years, age_months,
            first_visit_date, last_visit_date, last_visit_count, current_status,
            chief_complaint, birth_weight, delivery_method, memo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        const result = stmt.run(
          patient.patient_no, patient.name, patient.gender, patient.birth_date,
          patient.age_label, patient.age_years, patient.age_months,
          patient.first_visit_date, patient.first_visit_date, 1, patient.current_status,
          patient.chief_complaint, patient.birth_weight, patient.delivery_method, patient.memo || null, nowStr, nowStr
        )
        return { ...patient, id: result.lastInsertRowid, created_at: nowStr, updated_at: nowStr }
      }
    } catch (error) {
      console.error('[IPC] save-patient error:', error)
      throw error
    }
  })

  // 4. Delete Patient (with cascade deleting records and checksheet_items)
  ipcMain.handle('delete-patient', async (_, patientId: number) => {
    try {
      const db = getDatabase()
      const stmt = db.prepare('DELETE FROM patients WHERE id = ?')
      stmt.run(patientId)
      return { success: true }
    } catch (error) {
      console.error('[IPC] delete-patient error:', error)
      throw error
    }
  })

  // 5. Save Record (contains checksheet items and guidance comments)
  ipcMain.handle('save-record', async (_, record: any, checksheet: any) => {
    try {
      const db = getDatabase()
      const nowStr = new Date().toISOString()

      let recordId = record.id

      // 1. Transaction to ensure database integrity
      const transaction = db.transaction(() => {
        if (recordId) {
          // Update record
          const recordStmt = db.prepare(`
            UPDATE records SET
              record_date = ?, visit_label = ?, visit_count = ?,
              current_status = ?, initial_issues = ?, current_state = ?,
              diagnosis_note = ?, guidance_given = ?, next_handoff = ?,
              improvement_result = ?, updated_at = ?
            WHERE id = ?
          `)
          recordStmt.run(
            record.record_date, record.visit_label, record.visit_count,
            record.current_status, record.initial_issues, record.current_state,
            record.diagnosis_note, record.guidance_given, record.next_handoff,
            record.improvement_result, nowStr, recordId
          )
        } else {
          // Insert record
          const recordStmt = db.prepare(`
            INSERT INTO records (
              patient_id, record_date, visit_label, visit_count,
              current_status, initial_issues, current_state,
              diagnosis_note, guidance_given, next_handoff,
              improvement_result, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          const result = recordStmt.run(
            record.patient_id, record.record_date, record.visit_label, record.visit_count,
            record.current_status, record.initial_issues, record.current_state,
            record.diagnosis_note, record.guidance_given, record.next_handoff,
            record.improvement_result, nowStr, nowStr
          )
          recordId = result.lastInsertRowid
        }

        // 2. Save checksheet items
        const itemStmt = db.prepare(`
          INSERT OR REPLACE INTO checksheet_items (record_id, item_key, item_label, value, note)
          VALUES (?, ?, ?, ?, ?)
        `)

        if (checksheet) {
          for (const key of Object.keys(checksheet)) {
            const item = checksheet[key]
            itemStmt.run(recordId, key, item.label, item.value, item.note || null)
          }
        }

        // 3. Update patient's last visit details and status automatically
        const updatePatientStmt = db.prepare(`
          UPDATE patients SET
            last_visit_date = ?,
            last_visit_count = MAX(IFNULL(last_visit_count, 0), ?),
            current_status = ?,
            updated_at = ?
          WHERE id = ?
        `)
        updatePatientStmt.run(
          record.record_date,
          record.visit_count || 1,
          record.current_status || '',
          nowStr,
          record.patient_id
        )
      })

      transaction()
      return { success: true, recordId }
    } catch (error) {
      console.error('[IPC] save-record error:', error)
      throw error
    }
  })

  // 6. Excel Data Import Handler
  ipcMain.handle('import-excel', async (event) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender)
      const options = {
        title: 'Excel初期データの選択',
        filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
        properties: ['openFile'] as ('openFile')[]
      }
      const { canceled, filePaths } = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)

      if (canceled || filePaths.length === 0) {
        return { success: false, count: 0, error: '取り込みがキャンセルされました。' }
      }
      const selectedPath = filePaths[0]
      console.log(`[IPC] Importing Excel from selected path: ${selectedPath}`)
      const result = importExcelData(selectedPath)
      return result
    } catch (error: any) {
      console.error('[IPC] import-excel error:', error)
      return { success: false, count: 0, error: error.message }
    }
  })

  // 7. Get Guidance Templates
  ipcMain.handle('get-templates', async (_) => {
    try {
      const db = getDatabase()
      const stmt = db.prepare('SELECT * FROM guidance_templates WHERE is_active = 1')
      return stmt.all()
    } catch (error) {
      console.error('[IPC] get-templates error:', error)
      throw error
    }
  })

  // 8. Save/Update Guidance Template
  ipcMain.handle('save-template', async (_, template: any) => {
    try {
      const db = getDatabase()
      if (template.id) {
        // Update
        const stmt = db.prepare(`
          UPDATE guidance_templates
          SET category = ?, title = ?, body = ?
          WHERE id = ?
        `)
        stmt.run(template.category, template.title, template.body, template.id)
        return { ...template }
      } else {
        // Insert
        const stmt = db.prepare(`
          INSERT INTO guidance_templates (category, title, body)
          VALUES (?, ?, ?)
        `)
        const result = stmt.run(template.category, template.title, template.body)
        return { ...template, id: result.lastInsertRowid }
      }
    } catch (error) {
      console.error('[IPC] save-template error:', error)
      throw error
    }
  })

  // 9. Delete Guidance Template
  ipcMain.handle('delete-template', async (_, templateId: number) => {
    try {
      const db = getDatabase()
      const stmt = db.prepare('DELETE FROM guidance_templates WHERE id = ?')
      stmt.run(templateId)
      return { success: true }
    } catch (error) {
      console.error('[IPC] delete-template error:', error)
      throw error
    }
  })

  // 10. Get Attachments
  ipcMain.handle('get-attachments', async (_, recordId: number) => {
    try {
      const db = getDatabase()
      const stmt = db.prepare(`
        SELECT * FROM record_attachments 
        WHERE record_id = ? AND deleted_at IS NULL
        ORDER BY id ASC
      `)
      return stmt.all(recordId)
    } catch (error) {
      console.error('[IPC] get-attachments error:', error)
      throw error
    }
  })

  // 11. Select and Attach File from PC
  ipcMain.handle('select-attachment-file', async (event, patientId: number, recordId: number) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      const options = {
        title: '添付ファイル（画像・動画）の選択',
        filters: [
          { name: 'Images & Videos', extensions: ['jpg', 'jpeg', 'png', 'mp4', 'mov'] },
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png'] },
          { name: 'Videos', extensions: ['mp4', 'mov'] }
        ],
        properties: ['openFile'] as ('openFile')[]
      }
      
      const { canceled, filePaths } = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)

      if (canceled || filePaths.length === 0) {
        return { success: false, error: '選択がキャンセルされました。' }
      }

      const srcPath = filePaths[0]
      const stats = fs.statSync(srcPath)
      const maxSizeBytes = 300 * 1024 * 1024 // 300MB
      if (stats.size > maxSizeBytes) {
        return { success: false, error: 'ファイルサイズが上限（300MB）を超えています。' }
      }

      const userDataDir = app.getPath('userData')
      const destDir = path.join(userDataDir, 'attachments', String(patientId), String(recordId))
      
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true })
      }

      const ext = path.extname(srcPath)
      const originalName = path.basename(srcPath)
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
      const newFileName = `attachment_${uniqueSuffix}${ext}`
      const destPath = path.join(destDir, newFileName)

      fs.copyFileSync(srcPath, destPath)

      const extLower = ext.toLowerCase()
      const isVideo = extLower === '.mp4' || extLower === '.mov'
      const fileType = isVideo ? 'video' : 'image'
      let mimeType = 'image/jpeg'
      if (extLower === '.png') mimeType = 'image/png'
      else if (extLower === '.mp4') mimeType = 'video/mp4'
      else if (extLower === '.mov') mimeType = 'video/quicktime'

      const relPath = `${patientId}/${recordId}/${newFileName}`
      const nowStr = new Date().toISOString()

      const db = getDatabase()
      const stmt = db.prepare(`
        INSERT INTO record_attachments (
          record_id, patient_id, file_name, original_file_name,
          file_path, mime_type, file_type, file_size, uploaded_from, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        recordId,
        patientId,
        newFileName,
        originalName,
        relPath,
        mimeType,
        fileType,
        stats.size,
        'pc',
        nowStr
      )

      return { success: true }
    } catch (error: any) {
      console.error('[IPC] select-attachment-file error:', error)
      return { success: false, error: error.message || 'ファイルの添付処理に失敗しました。' }
    }
  })

  // 12. Delete Attachment
  ipcMain.handle('delete-attachment', async (_, attachmentId: number) => {
    try {
      const db = getDatabase()
      const getStmt = db.prepare('SELECT file_path FROM record_attachments WHERE id = ?')
      const attachment = getStmt.get(attachmentId) as { file_path: string }
      if (!attachment) {
        return { success: false, error: '添付ファイルが見つかりません。' }
      }

      const userDataDir = app.getPath('userData')
      const filePath = path.join(userDataDir, 'attachments', attachment.file_path)
      
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      } catch (fileErr) {
        console.warn('[IPC] delete-attachment: failed to delete physical file:', fileErr)
      }

      const delStmt = db.prepare('DELETE FROM record_attachments WHERE id = ?')
      delStmt.run(attachmentId)

      return { success: true }
    } catch (error: any) {
      console.error('[IPC] delete-attachment error:', error)
      return { success: false, error: error.message || '添付ファイルの削除に失敗しました。' }
    }
  })

  // 13. Start Mobile Upload Server
  ipcMain.handle('start-upload-server', async (_, patientId: number, recordId: number) => {
    try {
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      const { ip, port } = await startServer(patientId, recordId, token)
      
      const uploadUrl = `http://${ip}:${port}/?token=${token}`
      const qrDataUrl = await QRCode.toDataURL(uploadUrl)

      return {
        success: true,
        url: uploadUrl,
        qrDataUrl: qrDataUrl
      }
    } catch (error: any) {
      console.error('[IPC] start-upload-server error:', error)
      return { success: false, error: error.message || 'サーバーの起動に失敗しました。' }
    }
  })

  // 14. Stop Mobile Upload Server
  ipcMain.handle('stop-upload-server', async () => {
    try {
      stopServer()
      return { success: true }
    } catch (error: any) {
      console.error('[IPC] stop-upload-server error:', error)
      return { success: false, error: error.message }
    }
  })
}

// ----------------------------------------------------
// MOBILE UPLOAD SERVER HELPERS
// ----------------------------------------------------
let uploadServer: http.Server | null = null
let currentUploadToken: string | null = null

function stopServer(): void {
  if (uploadServer) {
    uploadServer.close()
    uploadServer = null
    currentUploadToken = null
    console.log('[Upload Server] Stopped.')
  }
}

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
          return iface.address
        }
      }
    }
  }
  return '127.0.0.1'
}

const startServer = (patientId: number, recordId: number, token: string): Promise<{ ip: string; port: number }> => {
  stopServer()
  currentUploadToken = token

  const port = 3010
  const ip = getLocalIpAddress()

  const userDataDir = app.getPath('userData')
  const uploadDir = path.join(userDataDir, 'attachments', String(patientId), String(recordId))
  
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir)
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
      const ext = path.extname(file.originalname)
      cb(null, `attachment_${uniqueSuffix}${ext}`)
    }
  })
  
  const upload = multer({
    storage,
    limits: { fileSize: 300 * 1024 * 1024 } // 300MB limit
  }).array('attachments', 10)

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url || '', `http://${ip}:${port}`)
      const reqToken = parsedUrl.searchParams.get('token')

      if (parsedUrl.pathname === '/meta') {
        if (!reqToken || reqToken !== currentUploadToken) {
          res.writeHead(403, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: '認証トークンが無効または期限切れです。' }))
          return
        }
        try {
          const db = getDatabase()
          const patient = db.prepare('SELECT name FROM patients WHERE id = ?').get(patientId) as { name: string }
          const record = db.prepare('SELECT visit_label FROM records WHERE id = ?').get(recordId) as { visit_label: string }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({
            patientName: patient ? patient.name : '不明',
            visitLabel: record ? record.visit_label : `${recordId}回目`
          }))
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'メタデータ取得エラー' }))
        }
        return
      }

      if (!reqToken || reqToken !== currentUploadToken) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('認証エラー: トークンが無効または期限切れです。再度QRコードを読み込んでください。')
        return
      }

      if (req.method === 'GET' && parsedUrl.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(UPLOAD_HTML)
        return
      }

      if (req.method === 'POST' && parsedUrl.pathname === '/upload') {
        upload(req as any, res as any, (err) => {
          if (err) {
            console.error('[Upload Server] Multer error:', err)
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ success: false, error: err.message || 'アップロード処理に失敗しました。' }))
            return
          }

          const files = (req as any).files as any[]
          if (!files || files.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ success: false, error: 'ファイルが送信されませんでした。' }))
            return
          }

          try {
            const db = getDatabase()
            const insertStmt = db.prepare(`
              INSERT INTO record_attachments (
                record_id, patient_id, file_name, original_file_name,
                file_path, mime_type, file_type, file_size, uploaded_from, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `)

            const nowStr = new Date().toISOString()

            for (const file of files) {
              const fileType = file.mimetype.startsWith('video/') ? 'video' : 'image'
              const relPath = `${patientId}/${recordId}/${file.filename}`
              
              insertStmt.run(
                recordId,
                patientId,
                file.filename,
                file.originalname,
                relPath,
                file.mimetype,
                fileType,
                file.size,
                'mobile',
                nowStr
              )
            }

            if (mainWindow) {
              mainWindow.webContents.send('attachment-uploaded', { recordId })
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ success: true, count: files.length }))
          } catch (dbErr) {
            console.error('[Upload Server] Database error:', dbErr)
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ success: false, error: 'データベースへの登録に失敗しました。' }))
          }
        })
        return
      }

      res.writeHead(404)
      res.end()
    })

    server.listen(port, '0.0.0.0', () => {
      uploadServer = server
      console.log(`[Upload Server] Listening on http://${ip}:${port}`)
      resolve({ ip, port })
    })

    server.on('error', (err) => {
      console.error('[Upload Server] Start error:', err)
      reject(err)
    })
  })
}

const UPLOAD_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>指導記録ファイルアップロード</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background-color: #f1f5f9; color: #1e293b; padding: 20px; margin: 0; }
    .container { max-width: 500px; margin: 0 auto; background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
    h2 { color: #0f172a; margin-top: 0; }
    .meta { background-color: #f8fafc; padding: 12px; border-radius: 8px; font-size: 14px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
    .meta-item { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .meta-item:last-child { margin-bottom: 0; }
    .meta-label { color: #64748b; font-weight: 600; }
    .file-input-wrapper { border: 2px dashed #cbd5e1; padding: 30px; text-align: center; border-radius: 8px; cursor: pointer; background-color: #f8fafc; transition: all 0.2s; position: relative; margin-bottom: 20px; }
    .file-input-wrapper:hover { border-color: #3b82f6; background-color: #eff6ff; }
    .file-input-wrapper input[type="file"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
    .file-input-text { font-size: 16px; font-weight: 600; color: #475569; }
    .file-input-subtext { font-size: 12px; color: #94a3b8; margin-top: 4px; }
    .btn { display: block; width: 100%; padding: 14px; background-color: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: background-color 0.2s; }
    .btn:hover { background-color: #2563eb; }
    .btn:disabled { background-color: #94a3b8; cursor: not-allowed; }
    .preview-container { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
    .preview-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px; }
    .preview-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%; font-weight: 500; }
    .preview-size { color: #64748b; font-size: 11px; }
    .progress-container { display: none; margin-top: 20px; background-color: #e2e8f0; border-radius: 10px; height: 10px; overflow: hidden; }
    .progress-bar { width: 0%; height: 100%; background-color: #10b981; transition: width 0.1s; }
    .status { text-align: center; margin-top: 10px; font-size: 14px; font-weight: 600; }
    .success-message { display: none; text-align: center; padding: 30px 20px; }
    .success-icon { font-size: 48px; color: #10b981; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="container" id="upload-box">
    <h2>ファイルをアップロード</h2>
    <div class="meta">
      <div class="meta-item"><span class="meta-label">対象患者:</span><span id="patient-name">---</span></div>
      <div class="meta-item"><span class="meta-label">指導回数:</span><span id="visit-label">---</span></div>
    </div>
    <form id="upload-form">
      <div class="file-input-wrapper">
        <div class="file-input-text">📸 写真・動画を選択</div>
        <div class="file-input-subtext">端末のカメラ起動またはライブラリから選択</div>
        <input type="file" id="file-selector" accept="image/*,video/*" multiple required>
      </div>
      <div class="preview-container" id="preview-list"></div>
      <button type="submit" class="btn" id="submit-btn" disabled>アップロード開始</button>
    </form>
    <div class="progress-container" id="progress-container">
      <div class="progress-bar" id="progress-bar"></div>
    </div>
    <div class="status" id="status-text"></div>
  </div>
  <div class="container success-message" id="success-box">
    <div class="success-icon">✓</div>
    <h2>アップロード完了</h2>
    <p>PC側の電子カルテ指導記録にファイルが自動追加されました。</p>
    <button class="btn" onclick="location.reload()">続けて追加アップロード</button>
  </div>
  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    let selectedFiles = [];

    fetch('/meta?token=' + encodeURIComponent(token))
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          document.getElementById('upload-box').innerHTML = '<h3 style="color:#ef4444;text-align:center;">エラー: ' + data.error + '</h3>';
        } else {
          document.getElementById('patient-name').innerText = data.patientName;
          document.getElementById('visit-label').innerText = data.visitLabel;
        }
      })
      .catch(err => {
        document.getElementById('upload-box').innerHTML = '<h3 style="color:#ef4444;text-align:center;">接続エラーが発生しました。</h3>';
      });

    const selector = document.getElementById('file-selector');
    const previewList = document.getElementById('preview-list');
    const submitBtn = document.getElementById('submit-btn');

    selector.addEventListener('change', (e) => {
      selectedFiles = Array.from(e.target.files);
      previewList.innerHTML = '';
      if (selectedFiles.length > 0) {
        selectedFiles.forEach(file => {
          const item = document.createElement('div');
          item.className = 'preview-item';
          
          const nameSpan = document.createElement('span');
          nameSpan.className = 'preview-name';
          nameSpan.innerText = file.name;
          
          const sizeSpan = document.createElement('span');
          sizeSpan.className = 'preview-size';
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          sizeSpan.innerText = sizeMB + ' MB';
          
          item.appendChild(nameSpan);
          item.appendChild(sizeSpan);
          previewList.appendChild(item);
        });
        submitBtn.disabled = false;
      } else {
        submitBtn.disabled = true;
      }
    });

    document.getElementById('upload-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (selectedFiles.length === 0) return;

      submitBtn.disabled = true;
      selector.disabled = true;
      document.getElementById('progress-container').style.display = 'block';
      document.getElementById('status-text').innerText = 'アップロード中...';

      const formData = new FormData();
      selectedFiles.forEach(file => {
        formData.append('attachments', file);
      });

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/upload?token=' + encodeURIComponent(token), true);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          document.getElementById('progress-bar').style.width = percentComplete + '%';
          document.getElementById('status-text').innerText = 'アップロード中 (' + Math.round(percentComplete) + '%)';
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const res = JSON.parse(xhr.responseText);
          if (res.success) {
            document.getElementById('upload-box').style.display = 'none';
            document.getElementById('success-box').style.display = 'block';
          } else {
            resetForm('エラー: ' + res.error);
          }
        } else {
          resetForm('エラーが発生しました (コード: ' + xhr.status + ')');
        }
      };

      xhr.onerror = () => {
        resetForm('サーバーとの通信に失敗しました。');
      };

      xhr.send(formData);
    });

    function resetForm(errorMsg) {
      submitBtn.disabled = false;
      selector.disabled = false;
      document.getElementById('progress-container').style.display = 'none';
      document.getElementById('progress-bar').style.width = '0%';
      document.getElementById('status-text').innerText = errorMsg;
      document.getElementById('status-text').style.color = '#ef4444';
    }
  </script>
</body>
</html>`
