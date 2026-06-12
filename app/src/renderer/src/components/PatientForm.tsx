import React, { useState, useEffect } from 'react'

interface Patient {
  id?: number
  patient_no: string
  name: string
  gender: string
  birth_date: string
  age_label: string
  age_years: number
  age_months: number
  first_visit_date: string
  current_status: string
  chief_complaint: string
  birth_weight: string // handle as string for input
  delivery_method: string
  delivery_method_other?: string
  memo?: string
  last_visit_date?: string
  last_visit_count?: number
}

interface PatientFormProps {
  patient: Patient | null
  onSaved: (savedPatient: any) => void
  onCancel: () => void
}

const PatientForm: React.FC<PatientFormProps> = ({ patient, onSaved, onCancel }) => {
  const [patientNo, setPatientNo] = useState('')
  const [name, setName] = useState('')
  const [gender, setGender] = useState('男')
  const [birthDate, setBirthDate] = useState('')
  const [firstVisitDate, setFirstVisitDate] = useState(new Date().toISOString().split('T')[0])
  const [currentStatus, setCurrentStatus] = useState('経過観察３m')
  const [customStatus, setCustomStatus] = useState('')
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [birthWeight, setBirthWeight] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState('正常分娩')
  const [deliveryMethodOther, setDeliveryMethodOther] = useState('')
  const [memo, setMemo] = useState('')

  // Toast notification state
  const [showToast, setShowToast] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastType, setToastType] = useState<'success' | 'error'>('success')

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

  // Age override state
  const [isAgeOverridden, setIsAgeOverridden] = useState(false)
  const [manualYears, setManualYears] = useState('')
  const [manualMonths, setManualMonths] = useState('')
  const [autoAgeLabel, setAutoAgeLabel] = useState('')

  // Predefined options
  const statusOptions = ['経過観察３m', '経過観察１m', '経過観察（MFT）', '継続２m', '継続３m', '指導中', 'MFT中', '終了', 'その他']
  const deliveryOptions = ['正常分娩', '帝王切開', '吸引分娩', 'その他']

  useEffect(() => {
    if (patient) {
      setPatientNo(patient.patient_no || '')
      setName(patient.name || '')
      setGender(patient.gender || '男')
      setBirthDate(patient.birth_date || '')
      setFirstVisitDate(patient.first_visit_date || new Date().toISOString().split('T')[0])
      
      const isStatusPredefined = statusOptions.includes(patient.current_status)
      if (isStatusPredefined) {
        setCurrentStatus(patient.current_status)
      } else {
        setCurrentStatus('その他')
        setCustomStatus(patient.current_status || '')
      }

      setChiefComplaint(patient.chief_complaint || '')
      setBirthWeight(patient.birth_weight ? String(patient.birth_weight) : '')

      const isDeliveryPredefined = deliveryOptions.includes(patient.delivery_method)
      if (isDeliveryPredefined) {
        setDeliveryMethod(patient.delivery_method)
      } else {
        setDeliveryMethod('その他')
        setDeliveryMethodOther(patient.delivery_method || '')
      }

      if (patient.age_years !== undefined || patient.age_months !== undefined) {
        setIsAgeOverridden(true)
        setManualYears(String(patient.age_years || '0'))
        setManualMonths(String(patient.age_months || '0'))
      }

      setMemo(patient.memo || '')
    }
  }, [patient])

  // Calculate age automatically from birthDate and firstVisitDate
  useEffect(() => {
    if (!birthDate) {
      setAutoAgeLabel('')
      return
    }

    const birth = new Date(birthDate)
    const base = firstVisitDate ? new Date(firstVisitDate) : new Date()

    if (isNaN(birth.getTime()) || isNaN(base.getTime())) {
      setAutoAgeLabel('')
      return
    }

    let years = base.getFullYear() - birth.getFullYear()
    let months = base.getMonth() - birth.getMonth()

    if (months < 0) {
      years--
      months += 12
    }

    if (base.getDate() < birth.getDate()) {
      months--
      if (months < 0) {
        years--
        months += 11
      }
    }

    // Protect against negative age
    if (years < 0) {
      setAutoAgeLabel('0ヶ月')
      return
    }

    let label = ''
    if (years > 0) label += `${years}歳`
    if (months > 0 || years === 0) label += `${months}ヶ月`
    if (years === 0 && months === 0) label = '0ヶ月'

    setAutoAgeLabel(label)

    if (!isAgeOverridden) {
      setManualYears(String(years))
      setManualMonths(String(months))
    }
  }, [birthDate, firstVisitDate, isAgeOverridden])

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()

    if (!name.trim()) {
      triggerToast('氏名は必須項目です。', 'error')
      return
    }

    // Validate manual age inputs (half-width digits only)
    let finalYears = 0
    let finalMonths = 0
    let finalAgeLabel = autoAgeLabel

    if (isAgeOverridden) {
      const yearsVal = manualYears.trim()
      const monthsVal = manualMonths.trim()

      if (!/^\d*$/.test(yearsVal) || !/^\d*$/.test(monthsVal)) {
        triggerToast('年齢（年・月）の補正入力は、半角数字のみで入力してください。', 'error')
        return
      }

      finalYears = parseInt(yearsVal || '0', 10)
      finalMonths = parseInt(monthsVal || '0', 10)

      let label = ''
      if (finalYears > 0) label += `${finalYears}歳`
      if (finalMonths > 0 || finalYears === 0) label += `${finalMonths}ヶ月`
      if (finalYears === 0 && finalMonths === 0) label = '0ヶ月'
      finalAgeLabel = label
    } else {
      // Parse auto age label
      const parsedYears = parseInt(manualYears || '0', 10)
      const parsedMonths = parseInt(manualMonths || '0', 10)
      finalYears = isNaN(parsedYears) ? 0 : parsedYears
      finalMonths = isNaN(parsedMonths) ? 0 : parsedMonths
    }

    const finalStatus = currentStatus === 'その他' ? customStatus : currentStatus
    const finalDelivery = deliveryMethod === 'その他' ? deliveryMethodOther : deliveryMethod

    const payload = {
      id: patient?.id,
      patient_no: patientNo.trim(),
      name: name.trim(),
      gender,
      birth_date: birthDate,
      age_label: finalAgeLabel,
      age_years: finalYears,
      age_months: finalMonths,
      first_visit_date: firstVisitDate,
      current_status: finalStatus.trim(),
      chief_complaint: chiefComplaint.trim(),
      birth_weight: birthWeight.trim() ? parseFloat(birthWeight) : null,
      delivery_method: finalDelivery.trim(),
      memo: memo.trim(),
      // Carry existing values if updating
      last_visit_date: patient?.last_visit_date || firstVisitDate,
      last_visit_count: patient?.last_visit_count || 1
    }

    try {
      const result = await window.api.savePatient(payload)
      onSaved(result)
    } catch (error) {
      console.error('Failed to save patient:', error)
      triggerToast('患者情報の保存に失敗しました。', 'error')
    }
  }

  return (
    <div className="scrollable-view">
      <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 className="card-title">
          {patient ? '患者基本情報の編集' : '新規患者の登録'}
        </h2>

        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">患者番号（No）</label>
              <input
                type="text"
                className="form-input"
                placeholder="例: 101 (未入力の場合は自動発番)"
                value={patientNo}
                onChange={(e) => setPatientNo(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                氏名 <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="例: 患者 太郎"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">性別</label>
              <div className="form-choice-group">
                <label className={`form-choice-label ${gender === '男' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="gender"
                    value="男"
                    checked={gender === '男'}
                    onChange={() => setGender('男')}
                  />
                  男
                </label>
                <label className={`form-choice-label ${gender === '女' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="gender"
                    value="女"
                    checked={gender === '女'}
                    onChange={() => setGender('女')}
                  />
                  女
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">生年月日</label>
              <input
                type="date"
                className="form-input"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          </div>

          {/* Age Section */}
          <div className="card" style={{ padding: '16px', background: '#f8fafc', borderStyle: 'dashed', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label className="form-label" style={{ margin: 0 }}>
                年齢・月齢（自動計算結果: <span style={{ color: 'var(--color-primary)', fontSize: '15px' }}>{autoAgeLabel || '生年月日未設定'}</span>）
              </label>
              <label className="form-choice-label" style={{ minHeight: '36px', padding: '0 10px', fontSize: '12px' }}>
                <input
                  type="checkbox"
                  checked={isAgeOverridden}
                  onChange={(e) => setIsAgeOverridden(e.target.checked)}
                />
                手動で補正入力する
              </label>
            </div>

            {isAgeOverridden && (
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">歳（半角数字のみ）</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="例: 1"
                    value={manualYears}
                    onChange={(e) => setManualYears(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">ヶ月（半角数字のみ）</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="例: 9"
                    value={manualMonths}
                    onChange={(e) => setManualMonths(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">初回日</label>
              <input
                type="date"
                className="form-input"
                value={firstVisitDate}
                onChange={(e) => setFirstVisitDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">主訴（初回課題）</label>
            <input
              type="text"
              className="form-input"
              placeholder="例: 丸飲み、お口ポカン、前歯で噛まない"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">出生体重 (g)</label>
              <input
                type="number"
                className="form-input"
                placeholder="例: 3000"
                value={birthWeight}
                onChange={(e) => setBirthWeight(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">分娩方法</label>
              <select
                className="form-select"
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value)}
              >
                {deliveryOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {deliveryMethod === 'その他' && (
                <input
                  type="text"
                  className="form-input"
                  style={{ marginTop: '8px' }}
                  placeholder="分娩方法の詳細を入力..."
                  value={deliveryMethodOther}
                  onChange={(e) => setDeliveryMethodOther(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '16px' }}>
            <label className="form-label">自由記入欄（基本情報）</label>
            <textarea
              className="form-textarea"
              placeholder="アレルギー情報、全身疾患、指しゃぶりなどの癖、またはその他特記事項を入力..."
              style={{ minHeight: '100px' }}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              キャンセル
            </button>
            <button type="submit" className="btn btn-primary">
              💾 保存する
            </button>
          </div>
        </form>
      </div>

      {showToast && (
        <div className={`toast-notification ${toastType}`}>
          <span>{toastType === 'success' ? '✨' : '⚠️'}</span> {toastMessage}
        </div>
      )}
    </div>
  )
}

export default PatientForm
