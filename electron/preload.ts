import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('voiceflow', {
  onRecordingState: (cb: (recording: boolean) => void) =>
    ipcRenderer.on('recording-state', (_e, val) => cb(val)),
  onTranscript: (cb: (text: string) => void) =>
    ipcRenderer.on('transcript', (_e, text) => cb(text)),
  onStatus: (cb: (status: string) => void) =>
    ipcRenderer.on('status', (_e, status) => cb(status)),
  sendAudio: (data: ArrayBuffer) => ipcRenderer.send('audio-data', data),
  sendRawTranscript: (text: string) => ipcRenderer.send('raw-transcript', text),
  hideHud: () => ipcRenderer.send('hide-hud'),
  showSettings: () => ipcRenderer.send('show-settings'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
})
