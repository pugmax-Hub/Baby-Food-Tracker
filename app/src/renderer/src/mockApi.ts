interface AppAPI {
  getPatients: (filters?: { name?: string; status?: string; keyword?: string }) => Promise<any[]>
  getPatientDetail: (patientId: number) => Promise<{ patient: any; records: any[] } | null>
  savePatient: (patient: any) => Promise<any>
  deletePatient: (patientId: number) => Promise<{ success: boolean }>
  saveRecord: (record: any, checksheet: any) => Promise<{ success: boolean; recordId: number }>
  importExcel: () => Promise<{ success: boolean; count: number; error?: string }>
  getTemplates: () => Promise<any[]>
  saveTemplate: (template: any) => Promise<any>
  deleteTemplate: (templateId: number) => Promise<{ success: boolean }>
  getAttachments: (recordId: number) => Promise<any[]>
  selectAttachmentFile: (patientId: number, recordId: number) => Promise<{ success: boolean; error?: string }>
  deleteAttachment: (attachmentId: number) => Promise<{ success: boolean; error?: string }>
  startUploadServer: (patientId: number, recordId: number) => Promise<{ success: boolean; url?: string; qrDataUrl?: string; error?: string }>
  stopUploadServer: () => Promise<{ success: boolean; error?: string }>
  onAttachmentUploaded?: (callback: (data: any) => void) => () => void
  isBrowser?: boolean
}

const LOCAL_STORAGE_PATIENTS_KEY = 'weaning_guidance_patients'
const LOCAL_STORAGE_RECORDS_KEY = 'weaning_guidance_records'
const LOCAL_STORAGE_TEMPLATES_KEY = 'weaning_guidance_templates'

// Initial templates
const defaultTemplates = [
  { id: 1, category: '姿勢', title: '足底接地', body: '椅子に座る際は、足の裏がしっかりと床または足置き台につくように調整してください。体幹が安定し、よく噛めるようになります。', is_active: 1 },
  { id: 2, category: '食形態', title: 'スプーンののせ方', body: 'スプーンは下唇の上にのせ、お子様自身が上唇を取り込んで食べるのを待ってください。奥に押し込まないようにしましょう。', is_active: 1 },
  { id: 3, category: '咀嚼', title: '一口量の調整', body: '一口の量が多いと丸飲みの原因になります。スプーンの先の3分の2程度を目安にして、よくモグモグしているか確認してください。', is_active: 1 },
  { id: 4, category: '水分補給', title: 'コップの練習', body: 'コップの練習は、少量の水や麦茶を入れ、コップの縁を上唇に軽くあてて傾け、少しずつすする感覚を覚えさせましょう。', is_active: 1 }
]

// Initial sample patients (anonymous)
const defaultPatients = [
  {
    id: 1001,
    patient_no: 'P-1001',
    name: '患者1001',
    gender: '男の子',
    birth_date: '2025-07-10',
    age_label: '0歳11ヶ月',
    age_years: 0,
    age_months: 11,
    first_visit_date: '2026-05-15',
    last_visit_date: '2026-06-01',
    last_visit_count: 2,
    current_status: '継続指導中',
    chief_complaint: '離乳食を丸のみしてしまい、よく噛んでいないように見える。また、椅子の上で姿勢が崩れやすい。',
    birth_weight: 3120,
    delivery_method: '経膣分娩',
    memo: 'アレルギー特になし。離乳食開始は順調だったが、最近丸呑みが目立つとのこと。'
  },
  {
    id: 1002,
    patient_no: 'P-1002',
    name: '患者1002',
    gender: '女の子',
    birth_date: '2025-10-05',
    age_label: '0歳8ヶ月',
    age_years: 0,
    age_months: 8,
    first_visit_date: '2026-06-01',
    last_visit_date: '2026-06-01',
    last_visit_count: 1,
    current_status: '経過観察',
    chief_complaint: '離乳食中期の2回食に進めたが、スプーンを嫌がって手で払いのけてしまう。水分補給のマグも吸い口を噛むだけで吸えない。',
    birth_weight: 2890,
    delivery_method: '帝王切開',
    memo: '哺乳瓶へのこだわりが強い。スプーンは柔らかいシリコンのもののみ試したとのこと。'
  },
  {
    id: 1003,
    patient_no: 'P-1003',
    name: '患者1003',
    gender: '男の子',
    birth_date: '2025-04-12',
    age_label: '1歳1ヶ月',
    age_years: 1,
    age_months: 1,
    first_visit_date: '2026-05-20',
    last_visit_date: '2026-05-20',
    last_visit_count: 1,
    current_status: '指導完了',
    chief_complaint: '離乳食完了期に移行中だが、片側ばかりで噛んでいないように見える。また乳歯の萌出が遅いのではないかと心配。',
    birth_weight: 3250,
    delivery_method: '経膣分娩',
    memo: '指しゃぶりの癖あり。乳歯は下前歯2本、上前歯2本のみ。'
  },
  {
    id: 1004,
    patient_no: 'P-1004',
    name: '患者1004',
    gender: '女の子',
    birth_date: '2025-12-20',
    age_label: '0歳5ヶ月',
    age_years: 0,
    age_months: 5,
    first_visit_date: '2026-06-08',
    last_visit_date: '2026-06-08',
    last_visit_count: 1,
    current_status: '新規受付',
    chief_complaint: '離乳食開始時期の相談。よだれは増えてきたがスプーンを口に入れると押し出してしまう様子がある。',
    birth_weight: 2950,
    delivery_method: '経膣分娩',
    memo: '首すわり、腰すわりは良好。食事の環境設定（ハイチェア）について指導希望。'
  }
]

// Initial sample records
const defaultRecords = [
  {
    id: 2001,
    patient_id: 1001,
    record_date: '2026-05-15',
    visit_label: '1回目',
    visit_count: 1,
    current_status: '継続指導中',
    initial_issues: '丸のみ傾向、姿勢が崩れる',
    current_state: 'スプーンを奥まで入れすぎているため丸飲みしている。足が床についておらず体幹がぐらつく。',
    diagnosis_note: '姿勢の改善が必要。足置きのある椅子を提案。',
    guidance_given: '足の裏がつくよう足置き台を設置することを指導。スプーンは下唇にのせるだけにして待つよう説明。',
    next_handoff: '姿勢の改善状態の確認、スプーン取り込みの様子確認。',
    improvement_result: '',
    checksheet: {
      teeth_eruption: { label: '歯の萌出状況', value: 'UR-A,UL-A,LR-A,LL-A', note: '上下2本ずつ萌出' },
      tongue_tie: { label: '舌小帯の長さ', value: '問題なし', note: '' },
      lip_tie: { label: '上唇小帯の長さ', value: '問題なし', note: '' },
      lip_closure: { label: '口唇閉鎖', value: '気になる', note: '離乳食中に口が開いている' },
      tongue_protrusion: { label: '舌突出', value: 'あり', note: '' },
      gulping_tendency: { label: '丸飲み傾向', value: 'あり', note: '咀嚼せず飲み込む' },
      one_sided_chewing: { label: '片側咀嚼', value: 'なし', note: '' },
      swallowing_choke: { label: '嚥下時のむせ', value: 'なし', note: '' },
      posture_issue: { label: '姿勢の問題', value: 'あり', note: '体が左右に傾く' },
      trunk_wobble: { label: '体幹のぐらつき', value: 'あり', note: '' },
      food_form: { label: '食形態', value: 'ペースト', note: '' },
      feeding_method: { label: '授乳方法', value: '混合', note: '' },
      hydration: { label: '水分補給', value: '哺乳瓶', note: '' },
      weaning_freq: { label: '離乳食回数', value: '2回', note: '' },
      feeding_freq: { label: '授乳回数', value: '5回', note: '' }
    }
  },
  {
    id: 2002,
    patient_id: 1001,
    record_date: '2026-06-01',
    visit_label: '2回目',
    visit_count: 2,
    current_status: '継続指導中',
    initial_issues: '丸のみ傾向、姿勢が崩れる',
    current_state: '足置き台を設置したことで姿勢は安定。スプーンの使い方も改善傾向。',
    diagnosis_note: '姿勢は良好。一口量を守るよう継続指導。',
    guidance_given: '姿勢の維持を褒め、スプーンを奥に入れないよう継続を指導。少しずつモグモグ咀嚼を促す。',
    next_handoff: '咀嚼の定着具合の確認。',
    improvement_result: '足置き台設置により姿勢が大きく改善した。丸飲みも頻度が減っている。',
    checksheet: {
      teeth_eruption: { label: '歯の萌出状況', value: 'UR-A,UL-A,LR-A,LL-A,UR-B,UL-B', note: '上4本、下2本' },
      tongue_tie: { label: '舌小帯の長さ', value: '問題なし', note: '' },
      lip_tie: { label: '上唇小帯の長さ', value: '問題なし', note: '' },
      lip_closure: { label: '口唇閉鎖', value: '問題なし', note: '改善した' },
      tongue_protrusion: { label: '舌突出', value: 'なし', note: 'スプーン取り込み時に押し出しなし' },
      gulping_tendency: { label: '丸飲み傾向', value: 'なし', note: 'モグモグ動作が見られる' },
      one_sided_chewing: { label: '片側咀嚼', value: 'なし', note: '' },
      swallowing_choke: { label: '嚥下時のむせ', value: 'なし', note: '' },
      posture_issue: { label: '姿勢の問題', value: 'なし', note: '足置き台の効果あり' },
      trunk_wobble: { label: '体幹のぐらつき', value: 'なし', note: '' },
      food_form: { label: '食形態', value: '舌でつぶせる', note: '少し形状を上げた' },
      feeding_method: { label: '授乳方法', value: '混合', note: '' },
      hydration: { label: '水分補給', value: 'スプーン', note: 'コップの練習開始' },
      weaning_freq: { label: '離乳食回数', value: '2回', note: '' },
      feeding_freq: { label: '授乳回数', value: '4回', note: '' }
    }
  },
  {
    id: 2003,
    patient_id: 1002,
    record_date: '2026-06-01',
    visit_label: '1回目',
    visit_count: 1,
    current_status: '経過観察',
    initial_issues: 'スプーン拒絶、水分補給',
    current_state: 'スプーンが口に触れると手で払う。自分で食べたがる意欲は強い。マグは噛むだけで吸えない。',
    diagnosis_note: 'スプーンを異物と捉えている可能性。シリコン製など柔らかい素材を提案。手づかみ食べも推奨。',
    guidance_given: 'スプーンの素材を変えること、手づかみ食べで食べる意欲を育てることを説明。マグはスパウトではなくコップからの練習を提案。',
    next_handoff: 'スプーン拒絶の緩和状態、コップでの水分補給の確認。',
    improvement_result: '',
    checksheet: {
      teeth_eruption: { label: '歯の萌出状況', value: 'UR-A,UL-A', note: '上2本萌出開始' },
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
      hydration: { label: '水分補給', value: '哺乳瓶', note: 'マグが吸えないため哺乳瓶中心' },
      weaning_freq: { label: '離乳食回数', value: '2回', note: '' },
      feeding_freq: { label: '授乳回数', value: '5回', note: '' }
    }
  }
]

const getLocalStorage = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key)
  if (!data) {
    localStorage.setItem(key, JSON.stringify(defaultValue))
    return defaultValue
  }
  try {
    return JSON.parse(data) as T
  } catch {
    return defaultValue
  }
}

const setLocalStorage = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value))
}

export const initMockApi = (): void => {
  // Initialize default items if not present
  getLocalStorage(LOCAL_STORAGE_PATIENTS_KEY, defaultPatients)
  getLocalStorage(LOCAL_STORAGE_RECORDS_KEY, defaultRecords)
  getLocalStorage(LOCAL_STORAGE_TEMPLATES_KEY, defaultTemplates)

  const api: AppAPI = {
    getPatients: async (filters) => {
      const patients = getLocalStorage(LOCAL_STORAGE_PATIENTS_KEY, defaultPatients)
      return patients.filter((p: any) => {
        if (filters?.name && !p.name.includes(filters.name)) return false
        if (filters?.status && p.current_status !== filters.status) return false
        if (filters?.keyword) {
          const kw = filters.keyword.toLowerCase()
          const nameMatch = p.name.toLowerCase().includes(kw)
          const noMatch = (p.patient_no || '').toLowerCase().includes(kw)
          const complaintMatch = (p.chief_complaint || '').toLowerCase().includes(kw)
          if (!nameMatch && !noMatch && !complaintMatch) return false
        }
        return true
      })
    },

    getPatientDetail: async (patientId) => {
      const patients = getLocalStorage(LOCAL_STORAGE_PATIENTS_KEY, defaultPatients)
      const patient = patients.find((p: any) => p.id === patientId)
      if (!patient) return null

      const records = getLocalStorage(LOCAL_STORAGE_RECORDS_KEY, defaultRecords)
      const patientRecords = records.filter((r: any) => r.patient_id === patientId)
      
      // Sort records descending by visit_count
      patientRecords.sort((a: any, b: any) => b.visit_count - a.visit_count)

      return { patient, records: patientRecords }
    },

    savePatient: async (patientPayload) => {
      const patients = getLocalStorage(LOCAL_STORAGE_PATIENTS_KEY, defaultPatients)
      let patientId = patientPayload.id

      const calcAgeLabel = (birthDateStr: string) => {
        if (!birthDateStr) return '-'
        const birth = new Date(birthDateStr)
        const now = new Date()
        let years = now.getFullYear() - birth.getFullYear()
        let months = now.getMonth() - birth.getMonth()
        if (months < 0) {
          years--
          months += 12
        }
        if (years > 0) {
          return `${years}歳${months}ヶ月`
        }
        return `${months}ヶ月`
      }

      const birth = patientPayload.birth_date ? new Date(patientPayload.birth_date) : null
      let years = 0
      let months = 0
      if (birth) {
        const now = new Date()
        years = now.getFullYear() - birth.getFullYear()
        months = now.getMonth() - birth.getMonth()
        if (months < 0) {
          years--
          months += 12
        }
      }

      if (patientId) {
        // Update
        const idx = patients.findIndex((p: any) => p.id === patientId)
        if (idx !== -1) {
          patients[idx] = {
            ...patients[idx],
            ...patientPayload,
            age_label: calcAgeLabel(patientPayload.birth_date),
            age_years: years,
            age_months: months
          }
        }
      } else {
        // Insert
        patientId = patients.length > 0 ? Math.max(...patients.map((p: any) => p.id)) + 1 : 1001
        patients.push({
          ...patientPayload,
          id: patientId,
          patient_no: `P-${patientId}`,
          age_label: calcAgeLabel(patientPayload.birth_date),
          age_years: years,
          age_months: months,
          last_visit_count: 0,
          last_visit_date: '',
          current_status: patientPayload.current_status || '新規受付'
        })
      }
      setLocalStorage(LOCAL_STORAGE_PATIENTS_KEY, patients)
      return { success: true, id: patientId }
    },

    deletePatient: async (patientId) => {
      const patients = getLocalStorage(LOCAL_STORAGE_PATIENTS_KEY, defaultPatients)
      const updatedPatients = patients.filter((p: any) => p.id !== patientId)
      setLocalStorage(LOCAL_STORAGE_PATIENTS_KEY, updatedPatients)

      const records = getLocalStorage(LOCAL_STORAGE_RECORDS_KEY, defaultRecords)
      const updatedRecords = records.filter((r: any) => r.patient_id !== patientId)
      setLocalStorage(LOCAL_STORAGE_RECORDS_KEY, updatedRecords)

      return { success: true }
    },

    saveRecord: async (recordPayload, checksheet) => {
      const records = getLocalStorage(LOCAL_STORAGE_RECORDS_KEY, defaultRecords)
      let recordId = recordPayload.id

      if (recordId) {
        // Update
        const idx = records.findIndex((r: any) => r.id === recordId)
        if (idx !== -1) {
          records[idx] = {
            ...records[idx],
            ...recordPayload,
            checksheet
          }
        }
      } else {
        // Insert
        recordId = records.length > 0 ? Math.max(...records.map((r: any) => r.id)) + 1 : 2001
        records.push({
          ...recordPayload,
          id: recordId,
          checksheet
        })
      }
      setLocalStorage(LOCAL_STORAGE_RECORDS_KEY, records)

      // Also update patient info
      const patients = getLocalStorage(LOCAL_STORAGE_PATIENTS_KEY, defaultPatients)
      const patientIdx = patients.findIndex((p: any) => p.id === recordPayload.patient_id)
      if (patientIdx !== -1) {
        const currentPatient = patients[patientIdx]
        const currentCount = currentPatient.last_visit_count || 0
        const newCount = recordPayload.visit_count || 1
        const maxCount = Math.max(currentCount, newCount)

        patients[patientIdx] = {
          ...currentPatient,
          last_visit_date: recordPayload.record_date,
          last_visit_count: maxCount,
          current_status: recordPayload.current_status || currentPatient.current_status
        }
        setLocalStorage(LOCAL_STORAGE_PATIENTS_KEY, patients)
      }

      return { success: true, recordId }
    },

    getTemplates: async () => {
      return getLocalStorage(LOCAL_STORAGE_TEMPLATES_KEY, defaultTemplates)
    },

    saveTemplate: async (templatePayload) => {
      const templates = getLocalStorage(LOCAL_STORAGE_TEMPLATES_KEY, defaultTemplates)
      let tmplId = templatePayload.id
      if (tmplId) {
        const idx = templates.findIndex((t: any) => t.id === tmplId)
        if (idx !== -1) {
          templates[idx] = {
            ...templates[idx],
            ...templatePayload
          }
        }
      } else {
        tmplId = templates.length > 0 ? Math.max(...templates.map((t: any) => t.id)) + 1 : 1
        templates.push({
          ...templatePayload,
          id: tmplId,
          is_active: 1
        })
      }
      setLocalStorage(LOCAL_STORAGE_TEMPLATES_KEY, templates)
      return { success: true }
    },

    deleteTemplate: async (templateId) => {
      const templates = getLocalStorage(LOCAL_STORAGE_TEMPLATES_KEY, defaultTemplates)
      const updated = templates.filter((t: any) => t.id !== templateId)
      setLocalStorage(LOCAL_STORAGE_TEMPLATES_KEY, updated)
      return { success: true }
    },

    getAttachments: async () => {
      return []
    },

    selectAttachmentFile: async () => {
      return { success: false, error: 'Web版ではPC内ファイル添付はサポートされていません。' }
    },

    deleteAttachment: async () => {
      return { success: false, error: 'Web版では添付ファイル削除はサポートされていません。' }
    },

    startUploadServer: async () => {
      return { success: false, error: 'Web版ではスマホ連携用サーバーは起動できません。' }
    },

    stopUploadServer: async () => {
      return { success: true }
    },

    importExcel: async () => {
      return { success: false, count: 0, error: 'Web版ではExcelファイルの取り込みはサポートされていません。Electron版をご利用ください。' }
    },

    isBrowser: true
  }

  // Assign to window global
  window.api = api
}
