import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

function Hud() {
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState('idle')
  const [transcript, setTranscript] = useState('')

  useEffect(() => {
    if (!(window as any).voiceflow) return

    ;(window as any).voiceflow.onRecordingState((val: boolean) => setRecording(val))
    ;(window as any).voiceflow.onTranscript((text: string) => { setTranscript(text); setStatus('done') })
    ;(window as any).voiceflow.onStatus((s: string) => setStatus(s))
  }, [])

  const isIdle = status === 'idle' && !recording && !transcript;

  return (
    <div style={{
      padding: isIdle ? '10px 15px' : '10px 20px',
      background: 'rgba(20,20,20,0.6)',
      backdropFilter: 'blur(12px)',
      borderRadius: '24px',
      color: '#fff',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      border: '1px solid rgba(255,255,255,0.08)',
      fontFamily: 'sans-serif',
      fontSize: '14px',
      WebkitAppRegion: 'drag',
      boxShadow: isIdle ? '0 4px 12px rgba(0,0,0,0.2)' : '0 4px 20px rgba(124, 106, 247, 0.3)',
      overflow: 'hidden',
      height: 'auto',
      transition: 'all 0.3s ease',
      cursor: 'grab'
    } as any}>
      <div style={{ 
        width: '12px', height: '12px', borderRadius: '50%', 
        background: recording ? '#ff4757' : (status === 'processing' ? '#eccc68' : '#7c6af7'),
        animation: recording ? 'pulse 1.5s infinite' : 'none',
        boxShadow: recording ? '0 0 10px #ff4757' : (status === 'processing' ? '0 0 10px #eccc68' : '0 0 10px #7c6af7')
      }}></div>
      
      {!isIdle && (
        <div style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
          {recording ? 'Listening...' : status === 'processing' ? 'Transcribing...' : transcript || 'Ready'}
        </div>
      )}
      <style>{`
        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.2); } 100% { opacity: 1; transform: scale(1); } }
        body { margin: 0; background: transparent; overflow: hidden; height: 100vh; padding: 10px; box-sizing: border-box; display: flex; align-items: flex-start; justify-content: flex-start; }
        #root { display: flex; align-items: flex-start; justify-content: flex-start; }
      `}</style>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Hud />
  </React.StrictMode>
)
