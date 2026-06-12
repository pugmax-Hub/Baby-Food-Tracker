import React, { useState } from 'react'
import PatientList from './components/PatientList'
import PatientDetail from './components/PatientDetail'
import PatientForm from './components/PatientForm'

type Screen = 'list' | 'detail' | 'form'

function App(): React.JSX.Element {
  const [currentScreen, setCurrentScreen] = useState<Screen>('list')
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null)
  const [editPatientData, setEditPatientData] = useState<any | null>(null)

  const navigateToList = (): void => {
    setCurrentScreen('list')
    setSelectedPatientId(null)
    setEditPatientData(null)
  }

  const navigateToDetail = (patientId: number): void => {
    setSelectedPatientId(patientId)
    setCurrentScreen('detail')
  }

  const navigateToForm = (patientToEdit?: any): void => {
    setEditPatientData(patientToEdit || null)
    setCurrentScreen('form')
  }

  return (
    <div className="app-container">
      {/* MVP Warn Banner */}
      <div className="warning-banner" id="mvp-warning-banner" style={{ background: window.api?.isBrowser ? 'linear-gradient(135deg, var(--color-danger), #b91c1c)' : undefined }}>
        <span style={{ fontSize: '18px' }}>⚠️</span>
        <p>
          {window.api?.isBrowser ? (
            <>
              <strong>【ブラウザ確認版（初回フィードバック専用）】</strong>
              このアプリはデモ確認用です。<strong>実患者の個人情報、画像、動画は絶対に入力しないでください。</strong>
              本運用版では、ローカルの安全なデータベース（SQLite）でのデータ管理やデータ保護設計が行われます。
            </>
          ) : (
            <>
              このMVPは画面・入力項目・業務フロー確認用です。
              実患者の個人情報、画像、動画は入力しないでください。
              本運用前に、認証、権限、バックアップ、操作ログ、データ保護設計を追加します。
            </>
          )}
        </p>
      </div>

      {/* Fixed Header */}
      <header className="main-header">
        <div className="header-title-area">
          {currentScreen !== 'list' && (
            <button className="btn btn-secondary btn-sm" onClick={navigateToList}>
              ← 患者一覧
            </button>
          )}
          <h1 className="app-title">食指導管理アプリ</h1>
          <span className="screen-title-badge">
            {currentScreen === 'list' && '患者一覧'}
            {currentScreen === 'detail' && '患者カルテ詳細'}
            {currentScreen === 'form' && (editPatientData ? '患者情報編集' : '新規患者登録')}
          </span>
        </div>
        <div className="header-actions">
          <span className="mvp-badge">MVP確認用</span>
        </div>
      </header>

      {/* Screen Views */}
      <main className="main-content">
        {currentScreen === 'list' && (
          <PatientList 
            onSelectPatient={navigateToDetail} 
            onAddNewPatient={() => navigateToForm()} 
          />
        )}
        {currentScreen === 'detail' && selectedPatientId && (
          <PatientDetail 
            patientId={selectedPatientId} 
            onEditPatient={(patient) => navigateToForm(patient)}
            onBack={navigateToList}
          />
        )}
        {currentScreen === 'form' && (
          <PatientForm 
            patient={editPatientData} 
            onSaved={(savedPatient) => navigateToDetail(savedPatient.id)}
            onCancel={editPatientData ? () => navigateToDetail(editPatientData.id) : navigateToList}
          />
        )}
      </main>
    </div>
  )
}

export default App
