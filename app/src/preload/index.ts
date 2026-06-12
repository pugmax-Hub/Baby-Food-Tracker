import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getPatients: (filters?: { name?: string; status?: string; keyword?: string }) =>
    ipcRenderer.invoke('get-patients', filters),
  getPatientDetail: (patientId: number) =>
    ipcRenderer.invoke('get-patient-detail', patientId),
  savePatient: (patient: any) =>
    ipcRenderer.invoke('save-patient', patient),
  deletePatient: (patientId: number) =>
    ipcRenderer.invoke('delete-patient', patientId),
  saveRecord: (record: any, checksheet: any) =>
    ipcRenderer.invoke('save-record', record, checksheet),
  importExcel: () =>
    ipcRenderer.invoke('import-excel'),
  getTemplates: () =>
    ipcRenderer.invoke('get-templates'),
  saveTemplate: (template: any) =>
    ipcRenderer.invoke('save-template', template),
  deleteTemplate: (templateId: number) =>
    ipcRenderer.invoke('delete-template', templateId),
  getAttachments: (recordId: number) =>
    ipcRenderer.invoke('get-attachments', recordId),
  selectAttachmentFile: (patientId: number, recordId: number) =>
    ipcRenderer.invoke('select-attachment-file', patientId, recordId),
  deleteAttachment: (attachmentId: number) =>
    ipcRenderer.invoke('delete-attachment', attachmentId),
  startUploadServer: (patientId: number, recordId: number) =>
    ipcRenderer.invoke('start-upload-server', patientId, recordId),
  stopUploadServer: () =>
    ipcRenderer.invoke('stop-upload-server'),
  onAttachmentUploaded: (callback: (data: any) => void) => {
    const listener = (_event: any, data: any) => callback(data)
    ipcRenderer.on('attachment-uploaded', listener)
    return () => {
      ipcRenderer.removeListener('attachment-uploaded', listener)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
