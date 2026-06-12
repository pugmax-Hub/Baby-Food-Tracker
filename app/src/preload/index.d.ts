import { ElectronAPI } from '@electron-toolkit/preload'

export interface AppAPI {
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

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
