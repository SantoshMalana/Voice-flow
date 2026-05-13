/// <reference types="vite/client" />

interface Window {
  voiceflow: {
    onRecordingState: (cb: (recording: boolean) => void) => void
    onTranscript: (cb: (text: string) => void) => void
    onStatus: (cb: (status: string) => void) => void
    sendAudio: (buffer: Buffer) => void
    hideHud: () => void
    showSettings: () => void
  }
}
