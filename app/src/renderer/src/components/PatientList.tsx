import React, { useEffect, useState } from 'react'

interface Patient {
  id: number
  patient_no: string
  name: string
  gender: string
  age_label: string
  first_visit_date: string
  last_visit_date: string
  last_visit_count: number
  current_status: string
  chief_complaint: string
  next_handoff?: string
}

interface PatientListProps {
  onSelectPatient: (id: number) => void
  onAddNewPatient: () => void
}

const PatientList: React.FC<PatientListProps> = ({ onSelectPatient, onAddNewPatient }) => {
  const [patients, setPatients] = useState<Patient[]>([])
  const [nameFilter, setNameFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [keywordFilter, setKeywordFilter] = useState('')
  const [importStatus, setImportStatus] = useState<{ loading: boolean; message: string | null; error: boolean } | null>(null)

  const loadPatients = async (): Promise<void> => {
    try {
      const data = await window.api.getPatients({
        name: nameFilter,
        status: statusFilter,
        keyword: keywordFilter
      })
      setPatients(data)
    } catch (error) {
      console.error('Failed to load patients:', error)
    }
  }

  useEffect(() => {
    loadPatients()
  }, [nameFilter, statusFilter, keywordFilter])

  const handleImportExcel = async (): Promise<void> => {
    if (!confirm('初期データが登録されたExcelファイル（.xlsx）を選択して取り込みます。よろしいですか？\n※既存の同ID患者は上書きまたは追加されます。')) {
      return
    }

    setImportStatus({ loading: true, message: 'Excelデータをインポート中...', error: false })

    try {
      const result = await window.api.importExcel()
      if (result.success) {
        setImportStatus({
          loading: false,
          message: `インポートが完了しました。${result.count} 名の患者データを取り込みました。`,
          error: false
        })
        loadPatients()
      } else {
        setImportStatus({
          loading: false,
          message: `インポートに失敗しました: ${result.error || '不明なエラー'}`,
          error: true
        })
      }
    } catch (error: any) {
      setImportStatus({
        loading: false,
        message: `通信エラーが発生しました: ${error.message || error}`,
        error: true
      })
    }
  }

  const getStatusBadgeClass = (status: string): string => {
    const s = status || ''
    if (s.includes('経過観察')) {
      return 'badge badge-status-observation'
    } else if (s.includes('継続') || s.includes('指導') || s.includes('MFT')) {
      return 'badge badge-status-active'
    } else if (s.includes('終了') || s.includes('キャンセル')) {
      return 'badge badge-status-finish'
    }
    return 'badge badge-status-other'
  }

  // Predefined statuses from existing Excel sheet
  const statusOptions = [
    '経過観察３m',
    '経過観察１m',
    '経過観察（MFT）',
    '継続２m',
    '継続３m',
    '指導中',
    'MFT中',
    '引越しのため終了',
    '終了'
  ]

  return (
    <div className="scrollable-view">
      <div className="list-actions">
        {/* Filters Area */}
        <div className="search-bar">
          <div style={{ flex: 2 }}>
            <input
              type="text"
              className="form-input"
              placeholder="患者氏名で検索..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>
          <div style={{ flex: 1.5 }}>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">すべてのステータス</option>
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2 }}>
            <input
              type="text"
              className="form-input"
              placeholder="課題キーワード・ステータス検索..."
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Buttons Area */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {!window.api?.isBrowser && (
            <button className="btn btn-secondary" onClick={handleImportExcel}>
              📊 Excel初期データ取込
            </button>
          )}
          <button className="btn btn-primary" onClick={onAddNewPatient}>
            ＋ 新規患者登録
          </button>
        </div>
      </div>

      {/* Import Status Alert Banner */}
      {importStatus && (
        <div 
          className="card" 
          style={{ 
            padding: '16px', 
            marginBottom: '20px', 
            backgroundColor: importStatus.error ? 'var(--color-danger-light)' : 'var(--color-success-light)',
            borderColor: importStatus.error ? 'var(--color-danger)' : 'var(--color-success)',
            color: importStatus.error ? 'var(--color-danger)' : 'var(--color-success)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600 }}>{importStatus.message}</span>
            {!importStatus.loading && (
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setImportStatus(null)}
                style={{ padding: '0 8px', minHeight: '30px' }}
              >
                閉じる
              </button>
            )}
          </div>
        </div>
      )}

      {/* Patients Table */}
      <div className="table-wrapper">
        <table className="patient-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>No</th>
              <th>氏名</th>
              <th style={{ width: '120px' }}>年齢・月齢</th>
              <th style={{ width: '180px' }}>現在のステータス</th>
              <th style={{ width: '120px' }}>初回日</th>
              <th style={{ width: '120px' }}>最終介入日</th>
              <th style={{ width: '80px' }}>回数</th>
              <th>次回対応（申し送り）</th>
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-light)', padding: '40px' }}>
                  該当する患者データが見つかりません。新規追加するかExcelデータを取込んでください。
                </td>
              </tr>
            ) : (
              patients.map((pat) => (
                <tr key={pat.id} onClick={() => onSelectPatient(pat.id)}>
                  <td style={{ fontWeight: 600, color: 'var(--color-text-light)' }}>
                    {pat.patient_no || pat.id}
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
                    {pat.name}
                  </td>
                  <td>{pat.age_label}</td>
                  <td>
                    <span className={getStatusBadgeClass(pat.current_status)}>
                      {pat.current_status || '未設定'}
                    </span>
                  </td>
                  <td>{pat.first_visit_date || '-'}</td>
                  <td>{pat.last_visit_date || '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>
                    {pat.last_visit_count ? `${pat.last_visit_count}回` : '-'}
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: '13px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pat.next_handoff}>
                    {pat.next_handoff || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default PatientList
