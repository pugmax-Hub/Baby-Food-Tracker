import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'

let db: Database.Database | null = null

// Function to format date-time for backup filename
function getTimestampString(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

// Automatic database backup logic
export function backupDatabase(dbPath: string): void {
  try {
    if (!fs.existsSync(dbPath)) {
      return
    }

    const userDataDir = app.getPath('userData')
    const backupsDir = path.join(userDataDir, 'backups')

    // Create backups directory if not exists
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true })
    }

    // List existing backups and rotate if more than 5
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('weaning_guidance_backup_') && f.endsWith('.db'))
      .map(f => ({
        name: f,
        filePath: path.join(backupsDir, f),
        mtime: fs.statSync(path.join(backupsDir, f)).mtime.getTime()
      }))
      .sort((a, b) => a.mtime - b.mtime)

    // Keep maximum of 5 backups (if >= 5, delete the oldest ones)
    if (files.length >= 5) {
      const toDeleteCount = files.length - 4 // Delete so we have 4 left, then write 5th
      for (let i = 0; i < toDeleteCount; i++) {
        fs.unlinkSync(files[i].filePath)
      }
    }

    // Copy current db file to backup file
    const backupFileName = `weaning_guidance_backup_${getTimestampString()}.db`
    const backupFilePath = path.join(backupsDir, backupFileName)
    fs.copyFileSync(dbPath, backupFilePath)
    console.log(`[Backup] Database backed up successfully to: ${backupFilePath}`)
  } catch (error) {
    console.error('[Backup] Failed to auto-backup database:', error)
  }
}

export function initDatabase(): Database.Database {
  if (db) return db

  const userDataDir = app.getPath('userData')
  const dbPath = path.join(userDataDir, 'weaning_guidance.db')

  console.log(`[Database] Database file path: ${dbPath}`)

  // Run automatic backup before opening database connection
  backupDatabase(dbPath)

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_no TEXT UNIQUE,
      name TEXT NOT NULL,
      gender TEXT,
      birth_date TEXT,
      age_label TEXT,
      age_years INTEGER,
      age_months INTEGER,
      first_visit_date TEXT,
      last_visit_date TEXT,
      last_visit_count INTEGER,
      current_status TEXT,
      chief_complaint TEXT,
      birth_weight REAL,
      delivery_method TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      record_date TEXT NOT NULL,
      visit_label TEXT,
      visit_count INTEGER,
      current_status TEXT,
      initial_issues TEXT,
      current_state TEXT,
      diagnosis_note TEXT,
      guidance_given TEXT,
      next_handoff TEXT,
      improvement_result TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS checksheet_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      item_key TEXT NOT NULL,
      item_label TEXT NOT NULL,
      value TEXT,
      note TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE,
      UNIQUE(record_id, item_key)
    );

    CREATE TABLE IF NOT EXISTS guidance_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT,
      title TEXT NOT NULL UNIQUE,
      body TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS record_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      patient_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      original_file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime_type TEXT,
      file_type TEXT,
      file_size INTEGER,
      uploaded_from TEXT,
      created_at TEXT NOT NULL,
      deleted_at TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );
  `)

  // Migration: Add memo column to patients if it doesn't exist
  try {
    const info = db.pragma('table_info(patients)') as any[]
    const hasMemo = info.some((col) => col.name === 'memo')
    if (!hasMemo) {
      db.exec('ALTER TABLE patients ADD COLUMN memo TEXT')
      console.log('[Database] Migrated: Added column "memo" to "patients" table.')
    }
  } catch (error) {
    console.error('[Database] Migration failed:', error)
  }

  // Prepopulate guidance templates if empty
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM guidance_templates')
  const result = countStmt.get() as { count: number }
  
  if (result.count === 0) {
    const insertTemplate = db.prepare(`
      INSERT INTO guidance_templates (category, title, body)
      VALUES (?, ?, ?)
    `)

    const templates = [
      { category: '姿勢', title: '足底接地', body: '・食事の姿勢を確認：足の裏がしっかりと床（または足置き台）についているか確認してください。\n・足がつかないと体が不安定になり、よく噛めなかったり、丸飲みになったりします。' },
      { category: '咀嚼', title: '前歯咀嚼', body: '・前歯でかじりとる練習をしてください。\n・前歯を使うことで、一口量を覚え、奥歯でつぶす準備（唾液分泌や顎の発達）を促します。' },
      { category: '食形態', title: '食形態調整', body: '・食材の大きさ・硬さを少し下げて様子を見ます。\n・進め急ぎによる丸飲みを防ぐため、スプーンで簡単につぶせる硬さ（豆腐やおから程度）に戻し、噛む動きを再確認します。' },
      { category: '食具', title: 'スプーン操作', body: '・スプーンは下唇の上にのせ、上唇が自力で取り込むのを待ちます。奥まで押し込まないように注意してください。\n・スプーンを上顎にこすりつけると丸飲みの原因になります。' },
      { category: '食具', title: 'コップ練習', body: '・コップの縁を軽く下唇にのせ、少し傾けて水分が口に入る感覚を練習します。\n・まずは少量の水や麦茶を浅いコップ（またはおちょこ等）で練習することをおすすめします。' },
      { category: '咀嚼', title: 'かじりとり', body: '・手づかみ食べができるサイズ（スティック状の野菜やトースト等）を少し大きめに用意し、前歯でかじりとらせてください。\n・これによって一口で入れる適切な量を自分で学習します。' },
      { category: '咀嚼', title: '一口量調整', body: '・一度に口に入れる量が多すぎないよう、小皿に取り分けるか、スプーンにのせる量を調整してください。\n・口いっぱいに詰め込むと噛まずに丸飲む原因になります。' },
      { category: '習慣', title: '指ストッパー', body: '・お口ポカンや口呼吸の癖がある場合、意識的に唇を閉じるトレーニングを行います。\n・遊びの中で口をすぼめる、ストローで吸う、お口のマッサージなどが効果的です。' },
      { category: '食事内容', title: 'おやつ・飲み物の見直し', body: '・ジュースや甘いおやつ、イオン飲料の頻度・時間を見直します。\n・水分補給は原則として水または麦茶とし、食事の妨げにならないように時間を決めます。' },
      { category: '授乳', title: '授乳回数の確認', body: '・離乳食の進み具合に合わせて、日中の授乳・ミルクの回数を段階的に調整していきます。\n・空腹感を持たせることで、離乳食を積極的に食べる意欲を促します。' }
    ]

    for (const t of templates) {
      insertTemplate.run(t.category, t.title, t.body)
    }
    console.log('[Database] Prepopulated 10 guidance templates.')
  }

  return db
}

export function getDatabase(): Database.Database {
  return initDatabase()
}
