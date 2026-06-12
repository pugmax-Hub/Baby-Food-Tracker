import * as XLSX from 'xlsx'
import fs from 'fs'
import { getDatabase } from './db'

function excelSerialToDate(serial: number): string {
  // Excel base date is 1899-12-30 due to a leap year bug in Lotus 1-2-3
  const date = new Date(1899, 11, 30 + serial)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseExcelDate(val: any): string | null {
  if (val === undefined || val === null) return null
  if (typeof val === 'number') {
    return excelSerialToDate(val)
  }
  if (val instanceof Date) {
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const str = String(val).trim()
  if (!str) return null
  
  // Try to match YYYY/M/D or YYYY-M-D
  const match = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (match) {
    const y = match[1]
    const m = match[2].padStart(2, '0')
    const d = match[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  
  return str
}

export function parseLastVisit(val: any): { date: string | null; count: number } {
  if (val === undefined || val === null) return { date: null, count: 1 }
  
  if (typeof val === 'number') {
    return { date: excelSerialToDate(val), count: 1 }
  }
  
  const str = String(val).trim()
  if (!str) return { date: null, count: 1 }

  // Circled number translation
  const circledMap: { [key: string]: number } = {
    '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5,
    '⑥': 6, '⑦': 7, '⑧': 8, '⑨': 9, '⑩': 10,
    '⑪': 11, '⑫': 12, '⑬': 13, '⑭': 14, '⑮': 15
  }
  
  let count = 1
  for (const char of str) {
    if (circledMap[char] !== undefined) {
      count = circledMap[char]
      break
    }
  }
  
  // Match standard numbers in parens like (3) or just standalone numbers at the end
  const countMatch = str.match(/[（(](\d+)[)）]$/) || str.match(/(\d+)$/)
  if (countMatch && count === 1) {
    count = parseInt(countMatch[1], 10)
  }

  // Match YYYY/M/D or YYYY-M-D date
  const dateMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  let dateStr: string | null = null
  
  if (dateMatch) {
    const y = dateMatch[1]
    const m = dateMatch[2].padStart(2, '0')
    const d = dateMatch[3].padStart(2, '0')
    dateStr = `${y}-${m}-${d}`
  } else {
    // Strip out circled number and parenthesis parts
    const datePart = str.replace(/[①-⑮]/g, '').replace(/[（(]\d+[)）]/g, '').trim()
    const num = Number(datePart)
    if (!isNaN(num) && num > 40000) {
      dateStr = excelSerialToDate(num)
    } else {
      dateStr = datePart || null
    }
  }

  return { date: dateStr, count }
}

export function parseAge(ageStr: any): { years: number; months: number; label: string } {
  const str = String(ageStr || '').trim()
  if (!str) return { years: 0, months: 0, label: '' }
  
  // Normalize full-width digits and alternative month spellings
  const normalized = str
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0))
    .replace(/歳/g, '歳')
    .replace(/ヶ月|ヵ月|ケ月|ヶ月|月/g, 'ヶ月')

  let years = 0
  let months = 0

  const yearsMatch = normalized.match(/(\d+)\s*歳/)
  const monthsMatch = normalized.match(/(\d+)\s*ヶ月/)

  if (yearsMatch) {
    years = parseInt(yearsMatch[1], 10)
  }
  if (monthsMatch) {
    months = parseInt(monthsMatch[1], 10)
  } else if (!yearsMatch) {
    // Case like "11ヶ月" or "11月" -> parsed as 11 months
    const justMonths = normalized.match(/^(\d+)/)
    if (justMonths) {
      months = parseInt(justMonths[1], 10)
    }
  }

  return { years, months, label: str }
}

export function importExcelData(filePath: string): { success: boolean; count: number; error?: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, count: 0, error: 'Excelファイルが見つかりません。' }
    }

    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet) as any[]

    const db = getDatabase()
    let importedCount = 0

    // Use transaction for speed and safety
    const insertPatient = db.prepare(`
      INSERT OR REPLACE INTO patients (
        patient_no, name, age_label, age_years, age_months,
        first_visit_date, last_visit_date, last_visit_count,
        current_status, chief_complaint, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertRecord = db.prepare(`
      INSERT INTO records (
        patient_id, record_date, visit_label, visit_count,
        current_status, initial_issues, current_state,
        diagnosis_note, next_handoff, improvement_result,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const transaction = db.transaction((rowsToImport: any[]) => {
      for (const row of rowsToImport) {
        // Skip header helper rows or empty rows
        if (!row['氏名'] && !row['ID']) continue

        const patientNo = String(row['ID'] || '').trim()
        const name = String(row['氏名'] || `未登録_${patientNo}`).trim()
        
        const ageParsed = parseAge(row['年齢'])
        const firstVisitDate = parseExcelDate(row['初回日'])
        const lastVisitInfo = parseLastVisit(row['最終介入日'])
        const currentStatus = String(row['現在のステータス'] || '').trim()
        const chiefComplaint = String(row['初回課題'] || '').trim()
        const nextHandoff = String(row['次回対応'] || '').trim()
        const improvementResult = String(row['改善結果'] || '').trim()
        
        const nowStr = new Date().toISOString()

        // 1. Insert patient
        const patientResult = insertPatient.run(
          patientNo,
          name,
          ageParsed.label,
          ageParsed.years,
          ageParsed.months,
          firstVisitDate,
          lastVisitInfo.date || firstVisitDate,
          lastVisitInfo.count,
          currentStatus,
          chiefComplaint,
          nowStr,
          nowStr
        )

        const patientId = patientResult.lastInsertRowid

        // 2. Insert initial record
        // According to specs, "初回課題", "次回対応", "改善結果" are saved as initial record.
        // Record date is set to the last visit date if available, otherwise first visit date.
        const recordDate = lastVisitInfo.date || firstVisitDate || new Date().toISOString().split('T')[0]
        const visitLabel = lastVisitInfo.count > 1 ? `${lastVisitInfo.count}回目` : '初回'

        insertRecord.run(
          patientId,
          recordDate,
          visitLabel,
          lastVisitInfo.count,
          currentStatus,
          chiefComplaint, // initial_issues
          currentStatus,  // current_state
          currentStatus,  // diagnosis_note
          nextHandoff,    // next_handoff
          improvementResult, // improvement_result
          nowStr,
          nowStr
        )

        importedCount++
      }
    })

    transaction(rows)
    return { success: true, count: importedCount }
  } catch (error: any) {
    console.error('[Importer] Failed to import excel data:', error)
    return { success: false, count: 0, error: error.message }
  }
}
