import React, { useEffect, useState } from 'react'

interface ChecksheetItem {
  value: string
  note: string
  label: string
}

interface Record {
  id?: number
  patient_id: number
  record_date: string
  visit_label: string
  visit_count: number
  current_status: string
  initial_issues: string
  current_state: string
  diagnosis_note: string
  guidance_given: string
  next_handoff: string
  improvement_result: string
  checksheet: { [key: string]: ChecksheetItem }
  is_placeholder?: boolean
  attachments?: any[]
}

interface Patient {
  id: number
  patient_no: string
  name: string
  gender: string
  birth_date: string
  age_label: string
  age_years: number
  age_months: number
  first_visit_date: string
  last_visit_date: string
  last_visit_count: number
  current_status: string
  chief_complaint: string
  birth_weight: number | null
  delivery_method: string
  memo?: string
}

interface PatientDetailProps {
  patientId: number
  onEditPatient: (patient: Patient) => void
  onBack: () => void
}

interface Template {
  id: number
  category: string
  title: string
  body: string
}

interface ConfigItem {
  key: string
  label: string
  type: 'choice' | 'select' | 'input' | 'multichoice'
  choices?: string[]
  options?: string[]
  placeholder?: string
}

const checksheetConfig: ConfigItem[] = [
  { key: 'tongue_tie', label: '舌小帯の長さ', type: 'choice', choices: ['問題なし', '気になる'] },
  { key: 'lip_tie', label: '上唇小帯の長さ', type: 'choice', choices: ['問題なし', '気になる'] },
  { key: 'lip_closure', label: '口唇閉鎖', type: 'choice', choices: ['問題なし', '気になる'] },
  { key: 'tongue_protrusion', label: '舌突出', type: 'choice', choices: ['なし', 'あり'] },
  { key: 'gulping_tendency', label: '丸飲み傾向', type: 'choice', choices: ['なし', 'あり'] },
  { key: 'one_sided_chewing', label: '片側咀嚼', type: 'choice', choices: ['なし', 'あり'] },
  { key: 'swallowing_choke', label: '嚥下時のむせ', type: 'choice', choices: ['なし', 'あり'] },
  { key: 'posture_issue', label: '姿勢の問題', type: 'choice', choices: ['なし', 'あり'] },
  { key: 'trunk_wobble', label: '体幹のぐらつき', type: 'choice', choices: ['なし', 'あり'] },
  { key: 'food_form', label: '食形態', type: 'select', options: ['ペースト', '舌でつぶせる', '歯茎でつぶせる', '歯茎でかめる', 'その他'] },
  { key: 'feeding_method', label: '授乳方法', type: 'choice', choices: ['母乳', 'ミルク', '混合', '卒乳', '断乳'] },
  { key: 'hydration', label: '水分補給', type: 'multichoice', choices: ['哺乳瓶', 'スプーン', 'コップ', 'マグ', 'その他'] },
  { key: 'weaning_freq', label: '離乳食回数', type: 'input', placeholder: '例: 2回' },
  { key: 'feeding_freq', label: '授乳回数', type: 'input', placeholder: '例: 5回' }
]

const PatientDetail: React.FC<PatientDetailProps> = ({ patientId, onEditPatient, onBack }) => {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [records, setRecords] = useState<Record[]>([])
  const [templates, setTemplates] = useState<Template[]>([])

  // Today's record input fields
  const [recordDate, setRecordDate] = useState('')
  const [visitLabel, setVisitLabel] = useState('')
  const [visitCount, setVisitCount] = useState(1)
  const [currentStatus, setCurrentStatus] = useState('')
  const [initialIssues, setInitialIssues] = useState('')
  const [currentState, setCurrentState] = useState('')
  const [diagnosisNote, setDiagnosisNote] = useState('')
  const [guidanceGiven, setGuidanceGiven] = useState('')
  const [nextHandoff, setNextHandoff] = useState('')
  const [improvementResult, setImprovementResult] = useState('')

  // Checksheet items state
  const [checksheet, setChecksheet] = useState<{ [key: string]: ChecksheetItem }>({
    teeth_eruption: { label: '歯の萌出状況', value: '', note: '' },
    tongue_tie: { label: '舌小帯の長さ', value: '問題なし', note: '' },
    lip_tie: { label: '上唇小帯の長さ', value: '問題なし', note: '' },
    lip_closure: { label: '口唇閉鎖', value: '問題なし', note: '' },
    tongue_protrusion: { label: '舌突出', value: 'なし', note: '' },
    gulping_tendency: { label: '丸飲み傾向', value: 'なし', note: '' },
    one_sided_chewing: { label: '片側咀嚼', value: 'なし', note: '' },
    swallowing_choke: { label: '嚥下時のむせ', value: 'なし', note: '' },
    posture_issue: { label: '姿勢の問題', value: 'なし', note: '' },
    trunk_wobble: { label: '体幹のぐらつき', value: 'なし', note: '' },
    food_form: { label: '食形態', value: 'ペースト', note: '' },
    feeding_method: { label: '授乳方法', value: '母乳', note: '' },
    hydration: { label: '水分補給', value: 'コップ', note: '' },
    weaning_freq: { label: '離乳食回数', value: '', note: '' },
    feeding_freq: { label: '授乳回数', value: '', note: '' }
  })

  // Accordion state (index of open record)
  const [openRecordIdx, setOpenRecordIdx] = useState<number | null>(null)

  // Track if we are editing an existing record
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null)

  // Track template manager modal
  const [showTemplateManager, setShowTemplateManager] = useState(false)

  // Toast notification state
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

  // Track if teeth diagram editor is expanded (only relevant on visitCount > 1)
  const [isTeethEditorOpen, setIsTeethEditorOpen] = useState(false)

  // Attachment states
  const [attachments, setAttachments] = useState<any[]>([])
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [uploadUrl, setUploadUrl] = useState('')
  const [showQrModal, setShowQrModal] = useState(false)
  const [activeMediaViewer, setActiveMediaViewer] = useState<{ url: string; type: 'image' | 'video'; title: string } | null>(null)

  const triggerToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg)
    setToastType(type)
    setShowToast(true)
  }

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => {
        setShowToast(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [showToast])

  const checksheetRec = [...records]
    .filter((r) => !r.is_placeholder && r.visit_count < visitCount)
    .find(
      (r) =>
        r.checksheet &&
        Object.keys(r.checksheet).length > 0 &&
        Object.values(r.checksheet).some((item) => item.value !== '')
    )

  const isChecksheetEditable = visitCount === 1

  const validateDateOrder = (count: number, dateStr: string, currentId?: number | null): string | null => {
    for (const r of records) {
      if (r.is_placeholder) continue
      if (currentId && r.id === currentId) continue
      if (r.visit_count < count && r.record_date > dateStr) {
        return `エラー: 介入回数が前にあたる ${r.visit_count}回目 (${r.record_date}) より前の日付は設定できません。`
      }
      if (r.visit_count > count && r.record_date < dateStr) {
        return `エラー: 介入回数が後にあたる ${r.visit_count}回目 (${r.record_date}) より後の日付は設定できません。`
      }
    }
    return null
  }

  // Load attachments for the current editingRecordId
  const loadAttachments = async (recordId: number) => {
    try {
      const list = await window.api.getAttachments(recordId)
      setAttachments(list)
    } catch (err) {
      console.error('Failed to load attachments:', err)
    }
  }

  const loadData = async (autoIncrement = false): Promise<void> => {
    try {
      const data = await window.api.getPatientDetail(patientId)
      if (data) {
        setPatient(data.patient)
        
        // Generate a complete timeline with placeholders for missing visit counts
        const realRecords = data.records || []
        const validVisitCounts = realRecords
          .map((r: any) => parseInt(r.visit_count, 10))
          .filter((v: number) => !isNaN(v))

        const maxCount = Math.max(
          parseInt(data.patient.last_visit_count, 10) || 0,
          validVisitCounts.length > 0 ? Math.max(...validVisitCounts) : 0,
          1 // Always show at least visit 1
        )

        const completeRecords: any[] = []
        for (let i = 1; i <= maxCount; i++) {
          const existing = realRecords.find((r: any) => r.visit_count === i)
          if (existing) {
            completeRecords.push(existing)
          } else {
            completeRecords.push({
              patient_id: patientId,
              visit_count: i,
              visit_label: `${i}回目`,
              record_date: i === 1 ? (data.patient.first_visit_date || '') : '',
              current_status: '',
              initial_issues: '',
              current_state: '',
              diagnosis_note: '',
              guidance_given: '',
              next_handoff: '',
              improvement_result: '',
              checksheet: {},
              is_placeholder: true
            })
          }
        }

        // Sort descending so newest visit count is first for timeline display
        completeRecords.sort((a, b) => b.visit_count - a.visit_count)
        setRecords(completeRecords)

        if (autoIncrement) {
          // Set initial visit count to maxCount + 1 or 1 if no records exist
          let nextCount = 1
          if (validVisitCounts.length > 0) {
            nextCount = Math.max(...validVisitCounts) + 1
          } else {
            const lastCount = parseInt(data.patient.last_visit_count, 10) || 0
            nextCount = lastCount > 1 ? lastCount + 1 : 1
          }
          setVisitCount(nextCount)
          setVisitLabel(`${nextCount}回目`)
          setCurrentStatus(data.patient.current_status || '')
          setInitialIssues(data.patient.chief_complaint || '')
          
          // Populate checksheet values from the record containing checksheet items if any exist
          const recordWithChecksheet = realRecords.find(
            (r: any) => r.checksheet && Object.keys(r.checksheet).length > 0
          )
          if (recordWithChecksheet) {
            setChecksheet((prev) => {
              const updated = { ...prev }
              for (const key of Object.keys(prev)) {
                if (recordWithChecksheet.checksheet && recordWithChecksheet.checksheet[key]) {
                  updated[key] = {
                    label: prev[key].label,
                    value: recordWithChecksheet.checksheet[key].value || prev[key].value,
                    note: recordWithChecksheet.checksheet[key].note || ''
                  }
                }
              }
              return updated
            })
          }
          if (realRecords.length > 0) {
            const latest = realRecords[realRecords.length - 1]
            setCurrentState(latest.current_state || '')
          }
        }
      }

      // Load guidance templates
      const tmpls = await window.api.getTemplates()
      setTemplates(tmpls)
    } catch (error) {
      console.error('Failed to load patient detail:', error)
    }
  }

  // Subscribe to mobile upload notifications
  useEffect(() => {
    if (window.api.onAttachmentUploaded) {
      const unsubscribe = window.api.onAttachmentUploaded((data: any) => {
        if (data && data.recordId === editingRecordId && editingRecordId) {
          triggerToast('スマホから新しいファイルがアップロードされました！')
          loadAttachments(editingRecordId)
        }
      })
      return () => {
        unsubscribe()
      }
    }
    return undefined
  }, [editingRecordId])

  useEffect(() => {
    loadData(true) // Initial load should set initial visitCount auto-incremented
    setIsTeethEditorOpen(false)
  }, [patientId])

  // Load data for existing record or reset to default for new record when visitCount changes
  useEffect(() => {
    const existing = records.find((r) => r.visit_count === visitCount)
    if (existing && !existing.is_placeholder) {
      setEditingRecordId(existing.id || null)
      setRecordDate(existing.record_date)
      setVisitLabel(existing.visit_label || `${visitCount}回目`)
      setCurrentStatus(existing.current_status || '')
      setInitialIssues(existing.initial_issues || '')
      setCurrentState(existing.current_state || '')
      setDiagnosisNote(existing.diagnosis_note || '')
      setGuidanceGiven(existing.guidance_given || '')
      setNextHandoff(existing.next_handoff || '')
      setImprovementResult(existing.improvement_result || '')
      if (existing.id) {
        loadAttachments(existing.id)
      }

      if (existing.checksheet) {
        setChecksheet((prev) => {
          const updated = { ...prev }
          for (const key of Object.keys(prev)) {
            if (existing.checksheet[key]) {
              updated[key] = {
                label: prev[key].label,
                value: existing.checksheet[key].value || prev[key].value,
                note: existing.checksheet[key].note || ''
              }
            } else {
              updated[key] = { ...prev[key], value: '', note: '' }
            }
          }
          return updated
        })
      }
    } else {
      // New unsaved record mode (either because it is a placeholder or a new visit count)
      setEditingRecordId(null)
      setAttachments([])
      if (existing && existing.is_placeholder && existing.record_date) {
        setRecordDate(existing.record_date)
      } else {
        setRecordDate(new Date().toISOString().split('T')[0])
      }
      setVisitLabel(`${visitCount}回目`)
      
      const latest = records.find((r) => !r.is_placeholder) // reversed records, so find first non-placeholder
      if (latest) {
        setCurrentStatus(patient?.current_status || '')
        setInitialIssues(patient?.chief_complaint || '')
        setCurrentState(latest.current_state || '')
      } else {
        setCurrentStatus(patient?.current_status || '')
        setInitialIssues(patient?.chief_complaint || '')
        setCurrentState('')
      }
      setDiagnosisNote('')
      setGuidanceGiven('')
      setNextHandoff('')
      setImprovementResult('')
      
      // For checksheet, if there's an existing checksheet in history, populate default values from it
      if (checksheetRec && checksheetRec.checksheet) {
        setChecksheet((prev) => {
          const updated = { ...prev }
          for (const key of Object.keys(prev)) {
            if (checksheetRec.checksheet[key]) {
              updated[key] = {
                label: prev[key].label,
                value: checksheetRec.checksheet[key].value || prev[key].value,
                note: checksheetRec.checksheet[key].note || ''
              }
            }
          }
          return updated
        })
      }
    }
  }, [visitCount, records, patientId])

  const handleSaveRecord = async (): Promise<void> => {
    if (!recordDate) {
      triggerToast('記録日は必須です。', 'error')
      return
    }

    // 1. Same visit count check for new records
    if (!editingRecordId) {
      const isDuplicate = records.some((r) => r.visit_count === visitCount && !r.is_placeholder)
      if (isDuplicate) {
        triggerToast(
          `エラー: 介入回数 ${visitCount}回目は既に保存されています。同じ介入回数の記録は保存できません。`,
          'error'
        )
        return
      }
    }

    // 2. Chronological date sequence validation
    const dateError = validateDateOrder(visitCount, recordDate, editingRecordId)
    if (dateError) {
      triggerToast(dateError, 'error')
      return
    }

    const recordPayload: any = {
      patient_id: patientId,
      record_date: recordDate,
      visit_label: visitLabel.trim() || `${visitCount}回目`,
      visit_count: visitCount,
      current_status: currentStatus.trim(),
      initial_issues: initialIssues.trim(),
      current_state: currentState.trim(),
      diagnosis_note: diagnosisNote.trim(),
      guidance_given: guidanceGiven.trim(),
      next_handoff: nextHandoff.trim(),
      improvement_result: improvementResult.trim()
    }
    if (editingRecordId) {
      recordPayload.id = editingRecordId
    }

    try {
      const result = await window.api.saveRecord(recordPayload, checksheet)
      if (result.success) {
        triggerToast('指導記録を保存しました。')
        // Reset inputs that are session-specific if we were in new record mode
        if (!editingRecordId) {
          setCurrentState('')
          setDiagnosisNote('')
          setGuidanceGiven('')
          setNextHandoff('')
          setImprovementResult('')
          await loadData(true) // Reload and auto-increment
        } else {
          // Keep the current visit count after editing
          await loadData(false)
        }
      }
    } catch (error) {
      console.error('Failed to save record:', error)
      triggerToast('記録の保存に失敗しました。', 'error')
    }
  }

  const handleDeletePatient = async (): Promise<void> => {
    if (confirm('【注意】この患者のすべてのデータおよび過去の指導記録が完全に削除されます。本当に削除しますか？')) {
      try {
        const result = await window.api.deletePatient(patientId)
        if (result.success) {
          alert('患者データを削除しました。')
          onBack()
        }
      } catch (error) {
        console.error('Failed to delete patient:', error)
        triggerToast('患者データの削除に失敗しました。', 'error')
      }
    }
  }

  const handleTemplateSelect = (body: string): void => {
    setGuidanceGiven((prev) => {
      const spacing = prev.trim() ? '\n' : ''
      return prev + spacing + body
    })
  }

  const handleAttachFromPC = async () => {
    if (!editingRecordId) return
    const res = await window.api.selectAttachmentFile(patientId, editingRecordId)
    if (res.success) {
      triggerToast('ファイルを添付しました。')
      loadAttachments(editingRecordId)
    } else if (res.error) {
      triggerToast(res.error, 'error')
    }
  }

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!confirm('この添付ファイルを削除しますか？\n（PC内のファイルデータも削除されます）')) return
    const res = await window.api.deleteAttachment(attachmentId)
    if (res.success) {
      triggerToast('添付ファイルを削除しました。')
      if (editingRecordId) {
        loadAttachments(editingRecordId)
      }
    } else if (res.error) {
      triggerToast(res.error, 'error')
    }
  }

  const handleStartMobileUpload = async () => {
    if (!editingRecordId) return
    const res = await window.api.startUploadServer(patientId, editingRecordId)
    if (res.success && res.url && res.qrDataUrl) {
      setUploadUrl(res.url)
      setQrDataUrl(res.qrDataUrl)
      setShowQrModal(true)
    } else {
      triggerToast(res.error || 'スマホ連携サーバーの起動に失敗しました。', 'error')
    }
  }

  const handleCloseQrModal = async () => {
    setShowQrModal(false)
    await window.api.stopUploadServer()
  }

  const handleMediaClick = (url: string, type: 'image' | 'video', title: string) => {
    setActiveMediaViewer({ url, type, title })
  }

  const updateChecksheetVal = (key: string, value: string): void => {
    setChecksheet((prev) => ({
      ...prev,
      [key]: { ...prev[key], value }
    }))
  }

  const updateChecksheetNote = (key: string, note: string): void => {
    setChecksheet((prev) => ({
      ...prev,
      [key]: { ...prev[key], note }
    }))
  }

  const toggleTooth = (quadrant: 'UR' | 'UL' | 'LR' | 'LL', tooth: string): void => {
    const toothKey = `${quadrant}-${tooth}`
    setChecksheet((prev) => {
      const currentVal = prev.teeth_eruption.value || ''
      const teethList = currentVal.split(',').filter(Boolean)
      let newVal = ''
      if (teethList.includes(toothKey)) {
        newVal = teethList.filter((t) => t !== toothKey).join(',')
      } else {
        newVal = [...teethList, toothKey].join(',')
      }
      return {
        ...prev,
        teeth_eruption: {
          ...prev.teeth_eruption,
          value: newVal
        }
      }
    })
  }

  const getURText = (teethStr: string): string => {
    const teeth = teethStr.split(',').filter(Boolean)
    return ['E', 'D', 'C', 'B', 'A'].filter((t) => teeth.includes(`UR-${t}`)).join('')
  }

  const getULText = (teethStr: string): string => {
    const teeth = teethStr.split(',').filter(Boolean)
    return ['A', 'B', 'C', 'D', 'E'].filter((t) => teeth.includes(`UL-${t}`)).join('')
  }

  const getLRText = (teethStr: string): string => {
    const teeth = teethStr.split(',').filter(Boolean)
    return ['E', 'D', 'C', 'B', 'A'].filter((t) => teeth.includes(`LR-${t}`)).join('')
  }

  const getLLText = (teethStr: string): string => {
    const teeth = teethStr.split(',').filter(Boolean)
    return ['A', 'B', 'C', 'D', 'E'].filter((t) => teeth.includes(`LL-${t}`)).join('')
  }

  if (!patient) {
    return <div className="scrollable-view"><p>読み込み中...</p></div>
  }

  return (
    <div className="detail-layout">
      {/* LEFT COLUMN: Patient Info */}
      <aside className="left-column">
        <div className="profile-card">
          <div className="profile-header">
            <span className="profile-id">ID: {patient.patient_no || patient.id}</span>
            <h2 className="profile-name">
              {patient.name}
              <span className="profile-gender">{patient.gender || '性別未設定'}</span>
            </h2>
          </div>

          <div className="profile-details">
            <div className="profile-item">
              <span className="profile-item-label">年齢・月齢</span>
              <span className="profile-item-val">{patient.age_label || '-'}</span>
            </div>
            <div className="profile-item">
              <span className="profile-item-label">生年月日</span>
              <span className="profile-item-val">{patient.birth_date || '-'}</span>
            </div>
            <div className="profile-item">
              <span className="profile-item-label">出生体重</span>
              <span className="profile-item-val">{patient.birth_weight ? `${patient.birth_weight} g` : '-'}</span>
            </div>
            <div className="profile-item">
              <span className="profile-item-label">分娩方法</span>
              <span className="profile-item-val">{patient.delivery_method || '-'}</span>
            </div>
            <div className="profile-item">
              <span className="profile-item-label">初回日</span>
              <span className="profile-item-val">{patient.first_visit_date || '-'}</span>
            </div>
            <div className="profile-item">
              <span className="profile-item-label">最終介入日</span>
              <span className="profile-item-val">{patient.last_visit_date || '-'}</span>
            </div>
            <div className="profile-item">
              <span className="profile-item-label">介入回数</span>
              <span className="profile-item-val">{patient.last_visit_count ? `${patient.last_visit_count} 回` : '-'}</span>
            </div>
            <div className="profile-item" style={{ marginTop: '8px' }}>
              <span className="profile-item-label">現在のステータス</span>
              <span className="badge badge-status-active" style={{ fontSize: '13px', alignSelf: 'flex-start' }}>
                {patient.current_status || '未設定'}
              </span>
            </div>
            <div className="profile-item">
              <span className="profile-item-label">主訴（初回課題）</span>
              <span className="profile-item-val" style={{ whiteSpace: 'pre-wrap', fontWeight: 'normal' }}>
                {patient.chief_complaint || '特になし'}
              </span>
            </div>
            <div className="profile-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <span className="profile-item-label">自由記入欄</span>
              <span className="profile-item-val" style={{ whiteSpace: 'pre-wrap', fontWeight: 'normal', marginTop: '4px' }}>
                {patient.memo || 'なし'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => onEditPatient(patient)}>
            ✏️ 基本情報を編集
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleDeletePatient}>
            🗑️ 患者を削除
          </button>
        </div>
      </aside>

      {/* RIGHT COLUMN: Entry & History */}
      <section className="right-column">
        {/* TODAY'S RECORD ENTRY FORM */}
        <div className="today-record-area">
          <div className="today-record-title">
            <span>📝 本日の指導記録</span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-light)', fontWeight: 'normal' }}>
              前回の数値を引き継いでいます
            </span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSaveRecord(); }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">記録日 <span className="required">*</span></label>
                <input
                  type="date"
                  className="form-input"
                  required
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">訪問ラベル</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例: 3回目 / 3ヶ月後"
                  value={visitLabel}
                  onChange={(e) => setVisitLabel(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">介入回数（数値）</label>
                <input
                  type="number"
                  className="form-input"
                  value={visitCount}
                  onChange={(e) => setVisitCount(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">初回課題（申し送り用）</label>
              <input
                type="text"
                className="form-input"
                value={initialIssues}
                onChange={(e) => setInitialIssues(e.target.value)}
              />
            </div>

            {/* CHECK SHEET ITEMS */}
            <div className="checksheet-border-box">
              <h3 className="checksheet-section-title" style={{ marginTop: 0, paddingLeft: 0, borderLeft: 'none' }}>🩺 離乳食チェックシート</h3>

              <div className="checksheet-grid">
                {/* 1. 乳歯の萌出状況カード - 他のカードと同サイズに統一 */}
                <div 
                  className="checksheet-card" 
                  style={{ 
                    border: '1.5px solid var(--color-accent)'
                  }}
                >
                  <div className="checksheet-card-header" style={{ borderBottomColor: 'var(--color-accent-light)' }}>
                    <span className="checksheet-card-label" style={{ color: 'var(--color-accent)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🦷 乳歯の萌出状況
                    </span>
                    {!isChecksheetEditable && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ minHeight: '24px', height: '24px', padding: '0 8px', fontSize: '11px', borderRadius: '12px' }}
                        onClick={() => setIsTeethEditorOpen(!isTeethEditorOpen)}
                      >
                        {isTeethEditorOpen ? '✕ 閉じる' : '✏️ 編集'}
                      </button>
                    )}
                  </div>
                  
                  {/* 2回目以降のデフォルト（コンパクト表示） */}
                  {!isChecksheetEditable && !isTeethEditorOpen ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2px 0' }}>
                        <div className="compact-teeth-box">
                          <div className="compact-teeth-row upper">
                            <div className="compact-teeth-quad UR">
                              {getURText(checksheet.teeth_eruption.value) || '\u00A0'}
                            </div>
                            <div className="compact-teeth-quad UL">
                              {getULText(checksheet.teeth_eruption.value) || '\u00A0'}
                            </div>
                          </div>
                          <div className="compact-teeth-row lower">
                            <div className="compact-teeth-quad LR">
                              {getLRText(checksheet.teeth_eruption.value) || '\u00A0'}
                            </div>
                            <div className="compact-teeth-quad LL">
                              {getLLText(checksheet.teeth_eruption.value) || '\u00A0'}
                            </div>
                          </div>
                        </div>
                      </div>
                      {checksheet.teeth_eruption.note && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontStyle: 'italic', marginTop: '1px', paddingLeft: '2px' }}>
                          メモ: {checksheet.teeth_eruption.note}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* 1回目、または2回目以降でエディタが展開されているとき */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div className="teeth-eruption-layout">
                        <div className="teeth-grid">
                          {/* UR (向かって左上) */}
                          <div className="teeth-quadrant UR">
                            <span className="quadrant-label upper-right-label">右上</span>
                            {['E', 'D', 'C', 'B', 'A'].map(tooth => {
                              const toothKey = `UR-${tooth}`
                              const isSelected = (checksheet.teeth_eruption.value || '').split(',').includes(toothKey)
                              return (
                                <button
                                  key={toothKey}
                                  type="button"
                                  className={`tooth-btn ${isSelected ? 'active' : ''}`}
                                  onClick={() => toggleTooth('UR', tooth)}
                                >
                                  {tooth}
                                </button>
                              )
                            })}
                          </div>
                          
                          {/* UL (向かって右上) */}
                          <div className="teeth-quadrant UL">
                            <span className="quadrant-label upper-left-label">左上</span>
                            {['A', 'B', 'C', 'D', 'E'].map(tooth => {
                              const toothKey = `UL-${tooth}`
                              const isSelected = (checksheet.teeth_eruption.value || '').split(',').includes(toothKey)
                              return (
                                <button
                                  key={toothKey}
                                  type="button"
                                  className={`tooth-btn ${isSelected ? 'active' : ''}`}
                                  onClick={() => toggleTooth('UL', tooth)}
                                >
                                  {tooth}
                                </button>
                              )
                            })}
                          </div>
                          
                          {/* LR (向かって左下) */}
                          <div className="teeth-quadrant LR">
                            <span className="quadrant-label lower-right-label">右下</span>
                            {['E', 'D', 'C', 'B', 'A'].map(tooth => {
                              const toothKey = `LR-${tooth}`
                              const isSelected = (checksheet.teeth_eruption.value || '').split(',').includes(toothKey)
                              return (
                                <button
                                  key={toothKey}
                                  type="button"
                                  className={`tooth-btn ${isSelected ? 'active' : ''}`}
                                  onClick={() => toggleTooth('LR', tooth)}
                                >
                                  {tooth}
                                </button>
                              )
                            })}
                          </div>
                          
                          {/* LL (向かって右下) */}
                          <div className="teeth-quadrant LL">
                            <span className="quadrant-label lower-left-label">左下</span>
                            {['A', 'B', 'C', 'D', 'E'].map(tooth => {
                              const toothKey = `LL-${tooth}`
                              const isSelected = (checksheet.teeth_eruption.value || '').split(',').includes(toothKey)
                              return (
                                <button
                                  key={toothKey}
                                  type="button"
                                  className={`tooth-btn ${isSelected ? 'active' : ''}`}
                                  onClick={() => toggleTooth('LL', tooth)}
                                >
                                  {tooth}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', minWidth: '70px' }}>メモ・補足:</span>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="例: 上下4本ずつ生え始め、など..."
                          style={{ minHeight: '32px', height: '32px', fontSize: '13px', padding: '0 8px' }}
                          value={checksheet.teeth_eruption.note || ''}
                          onChange={(e) => updateChecksheetNote('teeth_eruption', e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. その他のチェック項目カード（1回目は編集用UI、2回目以降は閲覧用テキストUI） */}
                {checksheetConfig.map((item) => (
                  <div className="checksheet-card" key={item.key}>
                    <div className="checksheet-card-header">
                      <span className="checksheet-card-label">{item.label}</span>
                    </div>

                    {!isChecksheetEditable ? (
                      /* 2回目以降の表示専用カード（他のカードと同じ大きさの枠で表示） */
                      <div style={{ padding: '2px 0', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-main)', padding: '4px 8px', background: 'var(--color-bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border-light)' }}>
                          {checksheet[item.key].value || '-'}
                        </div>
                        {checksheet[item.key].note && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-light)', fontStyle: 'italic', paddingLeft: '2px' }}>
                            メモ: {checksheet[item.key].note}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* 1回目の編集可能カード */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {item.type === 'choice' && (
                          <div className="form-choice-group">
                            {item.choices!.map((choice) => (
                              <label 
                                key={choice} 
                                className={`form-choice-label ${checksheet[item.key].value === choice ? 'selected' : ''}`}
                                style={{ minHeight: '32px', padding: '0 8px', fontSize: '12.5px' }}
                              >
                                <input
                                  type="radio"
                                  name={`check_${item.key}`}
                                  value={choice}
                                  checked={checksheet[item.key].value === choice}
                                  onChange={() => updateChecksheetVal(item.key, choice)}
                                />
                                {choice}
                              </label>
                            ))}
                          </div>
                        )}

                        {item.type === 'multichoice' && (
                          <div className="form-choice-group" style={{ flexWrap: 'wrap', gap: '6px' }}>
                            {item.choices!.map((choice) => {
                              const currentValues = (checksheet[item.key].value || '').split(',').filter(Boolean)
                              const isChecked = currentValues.includes(choice)
                              return (
                                <label 
                                  key={choice} 
                                  className={`form-choice-label ${isChecked ? 'selected' : ''}`}
                                  style={{ minHeight: '32px', padding: '0 8px', fontSize: '12.5px' }}
                                >
                                  <input
                                    type="checkbox"
                                    value={choice}
                                    checked={isChecked}
                                    onChange={(e) => {
                                      let newValues = [...currentValues]
                                      if (e.target.checked) {
                                        if (!newValues.includes(choice)) {
                                          newValues.push(choice)
                                        }
                                      } else {
                                        newValues = newValues.filter((v) => v !== choice)
                                      }
                                      updateChecksheetVal(item.key, newValues.join(','))
                                    }}
                                  />
                                  {choice}
                                </label>
                              )
                            })}
                          </div>
                        )}

                        {item.type === 'select' && (
                          <select
                            className="form-select"
                            style={{ minHeight: '32px', height: '32px', padding: '0 8px', fontSize: '13px' }}
                            value={checksheet[item.key].value}
                            onChange={(e) => updateChecksheetVal(item.key, e.target.value)}
                          >
                            {item.options!.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {item.type === 'input' && (
                          <input
                            type="text"
                            className="form-input"
                            style={{ minHeight: '32px', height: '32px', padding: '0 8px', fontSize: '13px' }}
                            placeholder={item.placeholder}
                            value={checksheet[item.key].value}
                            onChange={(e) => updateChecksheetVal(item.key, e.target.value)}
                          />
                        )}

                        <input
                          type="text"
                          className="form-input"
                          placeholder="メモ・補足..."
                          style={{ minHeight: '32px', height: '32px', fontSize: '11px', padding: '0 8px' }}
                          value={checksheet[item.key].note}
                          onChange={(e) => updateChecksheetNote(item.key, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* GUIDANCE NOTES */}
            <h3 className="checksheet-section-title">📝 指導内容・申し送り</h3>

            <div className="form-group">
              <label className="form-label">現状・お口の様子</label>
              <textarea
                className="form-textarea"
                placeholder="現在の咀嚼や姿勢、食事状況などを入力..."
                value={currentState}
                onChange={(e) => setCurrentState(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">所見メモ</label>
              <textarea
                className="form-textarea"
                placeholder="歯科医師・歯科衛生士の所見メモ（旧診断内容）..."
                value={diagnosisNote}
                onChange={(e) => setDiagnosisNote(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                伝えたこと（指導内容）
              </label>
              <div style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-light)' }}>
                    💡 指導テンプレート選択（クリックで追記）:
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', minHeight: '26px', fontSize: '11px', borderRadius: '15px' }}
                    onClick={() => setShowTemplateManager(true)}
                  >
                    ⚙️ テンプレート管理
                  </button>
                </div>
                <div className="templates-container">
                  {templates.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      className="template-pill"
                      onClick={() => handleTemplateSelect(tmpl.body)}
                    >
                      {tmpl.title}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="form-textarea"
                placeholder="保護者に説明した指導内容やアドバイスを入力してください..."
                value={guidanceGiven}
                onChange={(e) => setGuidanceGiven(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">次回申し送り・対応予定</label>
              <textarea
                className="form-textarea"
                placeholder="次回の診察・指導時に確認すべき項目や申し送りを入力..."
                value={nextHandoff}
                onChange={(e) => setNextHandoff(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">改善結果</label>
              <textarea
                className="form-textarea"
                placeholder="指導前と比較した改善具合、解決した課題など..."
                value={improvementResult}
                onChange={(e) => setImprovementResult(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">指導後のステータス更新</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: 経過観察３m"
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value)}
              />
            </div>

            {/* ATTACHMENT AREA */}
            <div className="checksheet-border-box" style={{ marginTop: '24px' }}>
              <h3 className="checksheet-section-title" style={{ marginTop: 0, paddingLeft: 0, borderLeft: 'none' }}>📎 添付ファイル（写真・動画）</h3>
              
              {!editingRecordId ? (
                <p style={{ fontSize: '13px', color: 'var(--color-text-light)', margin: 0, fontStyle: 'italic' }}>
                  💡 添付ファイル（写真やスマホからのアップロード）は、一度「記録を保存」した後に登録できるようになります。
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAttachFromPC}
                      style={{ fontSize: '13px', padding: '8px 16px', minHeight: '36px', height: '36px' }}
                    >
                      📁 PCから画像/動画を追加
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleStartMobileUpload}
                      style={{ fontSize: '13px', padding: '8px 16px', minHeight: '36px', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      📱 スマホ（iPhone/Android）から追加
                    </button>
                  </div>

                  {/* Thumbnail List */}
                  {attachments.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--color-text-light)', margin: 0 }}>
                      添付されているファイルはありません。
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px' }}>
                      {attachments.map((file) => (
                        <div key={file.id} className="attachment-thumbnail-card" style={{ border: '1px solid var(--color-border-light)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
                          <div 
                            className="attachment-thumbnail-preview"
                            onClick={() => handleMediaClick(`media://${file.file_path}`, file.file_type, file.original_file_name)}
                            style={{ height: '90px', overflow: 'hidden', cursor: 'pointer', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            {file.file_type === 'image' ? (
                              <img src={`media://${file.file_path}`} alt={file.original_file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ fontSize: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                🎬
                                <span style={{ fontSize: '9px', color: 'var(--color-text-light)', marginTop: '2px' }}>動画</span>
                              </div>
                            )}
                          </div>
                          <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.original_file_name}>
                              {file.original_file_name}
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--color-text-light)' }}>
                              {(file.file_size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteAttachment(file.id)}
                              style={{ width: '100%', padding: '2px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', border: 'none', borderRadius: '4px', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button type="submit" className="btn btn-primary btn-lg" style={{ minWidth: '200px' }}>
                💾 記録を保存
              </button>
            </div>
          </form>
        </div>

        {/* TIMELINE / HISTORY SECTION (ACCORDION STYLE) */}
        <div style={{ marginTop: '40px' }}>
          <h3 className="timeline-section-title">⏳ 過去の指導履歴</h3>
          {records.length === 0 ? (
            <p style={{ color: 'var(--color-text-light)', textAlign: 'center', padding: '24px' }}>
              過去の指導記録はありません。
            </p>
          ) : (
            <div className="history-accordion-list">
              {records.map((rec, idx) => (
                <div key={`visit-${rec.visit_count}`} className={`history-item ${rec.is_placeholder ? 'placeholder' : ''} ${openRecordIdx === idx ? 'open' : ''}`}>
                  <div className="history-header" onClick={() => setOpenRecordIdx(openRecordIdx === idx ? null : idx)}>
                    <div className="history-meta">
                      <span className="history-date">
                        {rec.is_placeholder ? (rec.record_date || '日付未設定') : rec.record_date}
                      </span>
                      <span className="history-visit-label">{rec.visit_label || `${rec.visit_count}回目`}</span>
                      <span className="history-summary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {rec.is_placeholder ? (
                          <span className="badge-placeholder" style={{ fontSize: '11px', padding: '1px 6px', border: '1px dashed var(--color-text-light)', borderRadius: '10px', color: 'var(--color-text-light)' }}>
                            未入力
                          </span>
                        ) : (
                          rec.current_state ? `現状: ${rec.current_state}` : '所見あり'
                        )}
                      </span>
                    </div>
                    <span className="history-arrow">▼</span>
                  </div>

                  <div className="history-content">
                    {rec.is_placeholder ? (
                      <div style={{ padding: '8px 4px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
                        <p style={{ fontSize: '13px', color: 'var(--color-text-light)', margin: 0 }}>
                          この回の指導記録はまだ登録されていません。
                          {rec.visit_count === 1 && '（1回目のため、日付の初期値として初診日が設定されます）'}
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ minHeight: '36px', height: '36px', padding: '0 14px' }}
                          onClick={() => {
                            setVisitCount(rec.visit_count)
                            document.querySelector('.today-record-area')?.scrollIntoView({ behavior: 'smooth' })
                          }}
                        >
                          ✏️ この回の指導記録を新規入力
                        </button>
                      </div>
                    ) : (
                      <div className="history-content-grid">
                        {/* Guidance Comments */}
                        <div className="history-memo-section">
                          {rec.current_state && (
                            <div className="history-memo-item">
                              <span className="history-memo-label">現状・お口の様子</span>
                              <span className="history-memo-val">{rec.current_state}</span>
                            </div>
                          )}
                          {rec.diagnosis_note && (
                            <div className="history-memo-item">
                              <span className="history-memo-label">所見メモ</span>
                              <span className="history-memo-val">{rec.diagnosis_note}</span>
                            </div>
                          )}
                          {rec.guidance_given && (
                            <div className="history-memo-item">
                              <span className="history-memo-label">伝えたこと（指導内容）</span>
                              <span className="history-memo-val">{rec.guidance_given}</span>
                            </div>
                          )}
                          {rec.next_handoff && (
                            <div className="history-memo-item">
                              <span className="history-memo-label">次回申し送り・対応予定</span>
                              <span className="history-memo-val">{rec.next_handoff}</span>
                            </div>
                          )}
                          {rec.improvement_result && (
                            <div className="history-memo-item">
                              <span className="history-memo-label">改善結果</span>
                              <span className="history-memo-val">{rec.improvement_result}</span>
                            </div>
                          )}
                          {rec.current_status && (
                            <div className="history-memo-item">
                              <span className="history-memo-label">指導後ステータス</span>
                              <span className="badge badge-status-observation" style={{ alignSelf: 'flex-start' }}>
                                {rec.current_status}
                              </span>
                            </div>
                          )}
                          
                          {/* Past Attachments History */}
                          {rec.attachments && rec.attachments.length > 0 && (
                            <div style={{ marginTop: '16px', borderTop: '1px dashed var(--color-border-light)', paddingTop: '12px' }}>
                              <span className="history-memo-label" style={{ marginBottom: '8px' }}>📎 添付ファイル ({rec.attachments.length}件)</span>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {rec.attachments.map((file: any) => (
                                  <div 
                                    key={file.id} 
                                    className="history-attachment-item"
                                    onClick={() => handleMediaClick(`media://${file.file_path}`, file.file_type, file.original_file_name)}
                                    style={{ width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--color-border-light)', cursor: 'pointer', position: 'relative', background: '#f8fafc' }}
                                  >
                                    {file.file_type === 'image' ? (
                                      <img src={`media://${file.file_path}`} alt={file.original_file_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                        🎬
                                        <span style={{ fontSize: '9px', color: 'var(--color-text-light)', marginTop: '2px' }}>動画</span>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setVisitCount(rec.visit_count)
                              document.querySelector('.today-record-area')?.scrollIntoView({ behavior: 'smooth' })
                            }}
                            style={{ alignSelf: 'flex-start', marginTop: '12px' }}
                          >
                            ✏️ この回を編集フォームに読み込む
                          </button>
                        </div>

                        {/* Checksheet items table */}
                        <div className="history-checksheet-section">
                          <h4 className="history-checksheet-title">🩺 問診チェック内容</h4>
                          {rec.checksheet && Object.keys(rec.checksheet).length > 0 ? (
                            <div className="history-checksheet-grid">
                              {/* すべての問診項目（乳歯の萌出状況含む）を同じ2列グリッド内に配置 */}
                              {rec.checksheet.teeth_eruption && (
                                <div className="history-checksheet-cell" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                  <span className="history-checksheet-cell-label" style={{ alignSelf: 'flex-start' }}>
                                    🦷 乳歯の萌出状況
                                  </span>
                                  <div className="compact-teeth-box" style={{ margin: '4px auto' }}>
                                    <div className="compact-teeth-row upper">
                                      <div className="compact-teeth-quad UR">
                                        {getURText(rec.checksheet.teeth_eruption.value) || '\u00A0'}
                                      </div>
                                      <div className="compact-teeth-quad UL">
                                        {getULText(rec.checksheet.teeth_eruption.value) || '\u00A0'}
                                      </div>
                                    </div>
                                    <div className="compact-teeth-row lower">
                                      <div className="compact-teeth-quad LR">
                                        {getLRText(rec.checksheet.teeth_eruption.value) || '\u00A0'}
                                      </div>
                                      <div className="compact-teeth-quad LL">
                                        {getLLText(rec.checksheet.teeth_eruption.value) || '\u00A0'}
                                      </div>
                                    </div>
                                  </div>
                                  {rec.checksheet.teeth_eruption.note && (
                                    <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '4px', borderTop: '1px dashed var(--color-border-light)', paddingTop: '4px', width: '100%', textAlign: 'center' }}>
                                      メモ: {rec.checksheet.teeth_eruption.note}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 2. その他の項目 */}
                              <div className="history-checksheet-grid">
                                {Object.keys(rec.checksheet)
                                  .filter(key => key !== 'teeth_eruption')
                                  .map((key) => {
                                    const item = rec.checksheet[key]
                                    return (
                                      <div className="history-checksheet-cell" key={key}>
                                        <span className="history-checksheet-cell-label">{item.label}</span>
                                        <span className="history-checksheet-cell-value">
                                          {item.value || '-'}
                                          {item.note ? ` (${item.note})` : ''}
                                        </span>
                                      </div>
                                    )
                                  })}
                              </div>
                            </div>
                          ) : (
                            <p style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                              この日のチェックシート項目はありません。
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {showTemplateManager && (
        <TemplateManagerModal
          templates={templates}
          triggerToast={triggerToast}
          onClose={async () => {
            setShowTemplateManager(false)
            const tmpls = await window.api.getTemplates()
            setTemplates(tmpls)
          }}
        />
      )}

      {showQrModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ maxWidth: '450px', width: '90%', textAlign: 'center', padding: '24px' }}>
            <div className="modal-header" style={{ justifyContent: 'center', position: 'relative' }}>
              <h3 className="modal-title">📱 スマホ（iPhone/Android）から追加</h3>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={handleCloseQrModal}
                style={{ position: 'absolute', right: 0, top: 0, minHeight: '30px', padding: '0 10px' }}
              >
                ✕ 閉じる
              </button>
            </div>
            
            <p style={{ fontSize: '13px', color: 'var(--color-text-main)', marginTop: '12px', marginBottom: '8px' }}>
              PCと同じWi-Fiにスマホを接続し、標準カメラで下のQRコードを読み取ってください。
            </p>

            {qrDataUrl ? (
              <div style={{ background: 'white', padding: '16px', borderRadius: '8px', display: 'inline-block', border: '1px solid var(--color-border-light)', margin: '12px 0' }}>
                <img src={qrDataUrl} alt="QR Code" style={{ width: '200px', height: '200px' }} />
              </div>
            ) : (
              <p style={{ color: 'var(--color-text-light)' }}>QRコードを生成中...</p>
            )}

            <div style={{ margin: '8px 0', background: 'var(--color-bg-app)', padding: '10px', borderRadius: '6px', border: '1px solid var(--color-border-light)', wordBreak: 'break-all' }}>
              <span style={{ fontSize: '11px', color: 'var(--color-text-light)', display: 'block', fontWeight: 600 }}>直接URLでアクセスする場合:</span>
              <a href={uploadUrl} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: 'var(--color-primary)', textDecoration: 'underline' }}>
                {uploadUrl}
              </a>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '16px', fontStyle: 'italic' }}>
              ※アップロード画面が開いたら、端末の写真ライブラリ等から画像・動画を選択してください。
            </p>
          </div>
        </div>
      )}

      {activeMediaViewer && (
        <div 
          className="modal-overlay" 
          style={{ zIndex: 1200, backgroundColor: 'rgba(0, 0, 0, 0.85)' }}
          onClick={() => setActiveMediaViewer(null)}
        >
          <div 
            className="modal-card" 
            style={{ maxWidth: '90vw', width: 'auto', background: 'transparent', boxShadow: 'none', padding: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', marginBottom: '12px', padding: '0 8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{activeMediaViewer.title}</span>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => setActiveMediaViewer(null)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', minHeight: '30px', padding: '0 12px', borderRadius: '15px' }}
              >
                ✕ 閉じる
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', maxHeight: '80vh', overflow: 'hidden' }}>
              {activeMediaViewer.type === 'image' ? (
                <img 
                  src={activeMediaViewer.url} 
                  alt={activeMediaViewer.title} 
                  style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} 
                />
              ) : (
                <video 
                  src={activeMediaViewer.url} 
                  controls 
                  autoPlay
                  style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: '8px' }} 
                />
              )}
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className={`toast-notification ${toastType}`}>
          <span>{toastType === 'success' ? '✨' : '⚠️'}</span> {toastMessage}
        </div>
      )}
    </div>
  )
}

interface TemplateManagerModalProps {
  templates: Template[]
  triggerToast: (msg: string, type?: 'success' | 'error') => void
  onClose: () => void
}

const TemplateManagerModal: React.FC<TemplateManagerModalProps> = ({ templates, triggerToast, onClose }) => {
  const [editingTmpl, setEditingTmpl] = useState<Partial<Template> | null>(null)
  const [category, setCategory] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [localTemplates, setLocalTemplates] = useState<Template[]>(templates)

  const reloadLocalTemplates = async () => {
    try {
      const data = await window.api.getTemplates()
      setLocalTemplates(data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) {
      triggerToast('タイトルと本文は必須です。', 'error')
      return
    }

    try {
      const payload = {
        id: editingTmpl?.id,
        category: category.trim() || 'その他',
        title: title.trim(),
        body: body.trim()
      }
      const result = await window.api.saveTemplate(payload)
      if (result) {
        triggerToast('テンプレートを保存しました。', 'success')
        setEditingTmpl(null)
        setCategory('')
        setTitle('')
        setBody('')
        reloadLocalTemplates()
      }
    } catch (err: any) {
      console.error(err)
      triggerToast(`保存に失敗しました: ${err.message || err}`, 'error')
    }
  }

  const handleEditClick = (tmpl: Template) => {
    setEditingTmpl(tmpl)
    setCategory(tmpl.category || '')
    setTitle(tmpl.title)
    setBody(tmpl.body || '')
  }

  const handleDeleteClick = async (tmplId: number) => {
    if (!confirm('このテンプレートを削除しますか？')) return
    try {
      const res = await window.api.deleteTemplate(tmplId)
      if (res.success) {
        triggerToast('テンプレートを削除しました。', 'success')
        if (editingTmpl?.id === tmplId) {
          setEditingTmpl(null)
          setCategory('')
          setTitle('')
          setBody('')
        }
        reloadLocalTemplates()
      }
    } catch (err) {
      console.error(err)
      triggerToast('削除に失敗しました。', 'error')
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '800px', width: '90%' }}>
        <div className="modal-header">
          <h3 className="modal-title">⚙️ 指導内容テンプレート管理</h3>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            style={{ minHeight: '30px', padding: '0 10px' }}
          >
            ✕ 閉じる
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', minHeight: '350px' }}>
          {/* Left: Template List */}
          <div style={{ borderRight: '1px solid var(--color-border-light)', paddingRight: '16px', maxHeight: '500px', overflowY: 'auto' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>登録済みテンプレート一覧</h4>
            {localTemplates.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--color-text-light)' }}>テンプレートがありません。</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {localTemplates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 10px',
                      background: 'var(--color-bg-app)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border-light)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-light)', fontWeight: 600 }}>
                        [{tmpl.category || 'その他'}]
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tmpl.title}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0 6px', minHeight: '26px', fontSize: '11px' }}
                        onClick={() => handleEditClick(tmpl)}
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0 6px', minHeight: '26px', fontSize: '11px' }}
                        onClick={() => handleDeleteClick(tmpl.id)}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Add / Edit Form */}
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '10px' }}>
              {editingTmpl ? '✏️ テンプレートの編集' : '＋ 新規テンプレート追加'}
            </h4>
            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="form-group">
                <label className="form-label">カテゴリ</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例: 姿勢 / 咀嚼 / 食形態"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">タイトル <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="例: 足底接地"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">テンプレート本文 <span className="required">*</span></label>
                <textarea
                  className="form-textarea"
                  placeholder="指導内容欄に追記される説明文を入力してください..."
                  required
                  style={{ minHeight: '160px' }}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                {editingTmpl && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setEditingTmpl(null)
                      setCategory('')
                      setTitle('')
                      setBody('')
                    }}
                  >
                    キャンセル
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingTmpl ? '💾 更新する' : '＋ 追加する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PatientDetail
