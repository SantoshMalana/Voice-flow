import { useEffect, useState, useRef } from 'react'
import logoSrc from './logo.png'
import './App.css'

declare global {
  interface Window {
    voiceflow: {
      onRecordingState: (cb: (recording: boolean) => void) => void
      onTranscript: (cb: (text: string) => void) => void
      onStatus: (cb: (status: string) => void) => void
      sendAudio: (data: ArrayBuffer) => void
      sendRawTranscript: (text: string) => void
      hideHud: () => void
      showSettings: () => void
      getConfig: () => Promise<any>
      saveConfig: (config: any) => Promise<void>
    }
  }
}

type Tab = 'home' | 'hotkeys' | 'apikeys'

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [recording, setRecording] = useState(false)
  const [status, setStatus] = useState('idle')
  const [transcript, setTranscript] = useState('')

  // Config state
  const [groqKeys, setGroqKeys] = useState<string[]>([''])
  const [cerebrasKeys, setCerebrasKeys] = useState<string[]>([''])
  const [dictationHotkey, setDictationHotkey] = useState('CommandOrControl+Shift+D')
  const [codeHotkey, setCodeHotkey] = useState('CommandOrControl+Shift+C')
  const [professionalHotkey, setProfessionalHotkey] = useState('CommandOrControl+Shift+E')
  const [saved, setSaved] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!window.voiceflow) return
    window.voiceflow.onRecordingState((val) => {
      setRecording(val)
      if (val) startMicCapture()
      else stopMicCapture()
    })
    window.voiceflow.onTranscript((text) => { setTranscript(text); setStatus('done') })
    window.voiceflow.onStatus((s) => setStatus(s))

    window.voiceflow.getConfig().then((conf: any) => {
      if (!conf) return
      if (conf.groqKeys?.length) setGroqKeys(conf.groqKeys)
      if (conf.cerebrasKeys?.length) setCerebrasKeys(conf.cerebrasKeys)
      if (conf.dictationHotkey) setDictationHotkey(conf.dictationHotkey)
      if (conf.codeHotkey) setCodeHotkey(conf.codeHotkey)
      if (conf.professionalHotkey) setProfessionalHotkey(conf.professionalHotkey)
    })
  }, [])

  async function startMicCapture() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start()
      mediaRecorderRef.current = mr
    } catch (e) { console.error('[App] Mic error:', e) }
  }

  function stopMicCapture() {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') return
    mediaRecorderRef.current = null
    const recordedChunks: Blob[] = [...chunksRef.current]
    chunksRef.current = []
    mr.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data) }
    mr.onstop = async () => {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' })
      if (blob.size < 500) return
      const arrayBuffer = await blob.arrayBuffer()
      window.voiceflow.sendAudio(arrayBuffer)
    }
    mr.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setStatus('processing')
  }

  const handleSave = async () => {
    await window.voiceflow.saveConfig({
      groqKeys: groqKeys.filter(k => k.trim() !== ''),
      cerebrasKeys: cerebrasKeys.filter(k => k.trim() !== ''),
      dictationHotkey, codeHotkey, professionalHotkey
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const navItems: { id: Tab; label: string; icon: string }[] = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'hotkeys', label: 'Hotkeys', icon: '⌨️' },
    { id: 'apikeys', label: 'API Keys', icon: '🔑' },
  ]

  const statusColor = recording ? '#ff4757' : status === 'processing' ? '#f9ca24' : '#7c6af7'
  const statusLabel = recording ? 'Recording…' : status === 'processing' ? 'Processing…' : status === 'done' ? 'Done' : 'Ready'

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#111114', color: '#e8e8f0', fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{ width: '200px', background: '#1a1a20', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Logo area */}
        <div style={{ padding: '28px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={logoSrc} alt="VoiceFlow" style={{ width: '36px', height: '36px', borderRadius: '10px' }} />
            <span style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.3px' }}>VoiceFlow</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px' }}>
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                marginBottom: '4px', fontSize: '14px', fontWeight: tab === item.id ? '600' : '400',
                background: tab === item.id ? 'rgba(124,106,247,0.18)' : 'transparent',
                color: tab === item.id ? '#a89df7' : '#8888a0',
                transition: 'all 0.15s ease', textAlign: 'left'
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Status indicator */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
            <span style={{ fontSize: '12px', color: '#666' }}>{statusLabel}</span>
          </div>
          {transcript && status === 'done' && (
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#555', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as any}>
              {transcript}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tab === 'home' && <HomeTab dictationHotkey={dictationHotkey} codeHotkey={codeHotkey} professionalHotkey={professionalHotkey} />}
        {tab === 'hotkeys' && (
          <HotkeysTab
            dictationHotkey={dictationHotkey} setDictationHotkey={setDictationHotkey}
            codeHotkey={codeHotkey} setCodeHotkey={setCodeHotkey}
            professionalHotkey={professionalHotkey} setProfessionalHotkey={setProfessionalHotkey}
            onSave={handleSave} saved={saved}
          />
        )}
        {tab === 'apikeys' && (
          <ApiKeysTab
            groqKeys={groqKeys} setGroqKeys={setGroqKeys}
            cerebrasKeys={cerebrasKeys} setCerebrasKeys={setCerebrasKeys}
            onSave={handleSave} saved={saved}
          />
        )}
      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle }: { title: string, subtitle: string }) {
  return (
    <div style={{ paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '28px' }}>
      <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#f0f0f8' }}>{title}</h2>
      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>{subtitle}</p>
    </div>
  )
}

function SaveButton({ onSave, saved }: { onSave: () => void, saved: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '28px' }}>
      <button
        onClick={onSave}
        style={{ padding: '10px 28px', background: '#7c6af7', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
      >
        Save Changes
      </button>
      {saved && <span style={{ color: '#2ed573', fontSize: '13px', fontWeight: '500' }}>✓ Saved!</span>}
    </div>
  )
}

function HomeTab({ dictationHotkey, codeHotkey, professionalHotkey }: { dictationHotkey: string, codeHotkey: string, professionalHotkey: string }) {
  const modes = [
    { icon: '🎙️', label: 'Dictation', desc: 'Voice-to-text in any app', hotkey: dictationHotkey, color: '#7c6af7' },
    { icon: '💻', label: 'Code Mode', desc: 'Dictate instructions, get code', hotkey: codeHotkey, color: '#f9ca24' },
    { icon: '👔', label: 'Professional', desc: 'Polished, formal business text', hotkey: professionalHotkey, color: '#f368e0' },
  ]

  return (
    <div style={{ padding: '40px 48px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ marginBottom: '10px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#f0f0f8' }}>Welcome back</h1>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#666' }}>VoiceFlow is running in the background. Use your hotkeys to start.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '36px' }}>
        {modes.map(m => (
          <div key={m.label} style={{ background: '#1a1a20', borderRadius: '12px', padding: '22px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>{m.icon}</div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#e8e8f0', marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>{m.desc}</div>
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', fontFamily: 'monospace', color: m.color, display: 'inline-block', border: `1px solid ${m.color}33` }}>
              {m.hotkey}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '28px', background: '#1a1a20', borderRadius: '10px', padding: '16px 20px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '18px' }}>💡</span>
        <span style={{ fontSize: '13px', color: '#8888a0' }}>Close this window anytime — VoiceFlow stays active in your system tray and your hotkeys keep working.</span>
      </div>
    </div>
  )
}

function HotkeysTab({ dictationHotkey, setDictationHotkey, codeHotkey, setCodeHotkey, professionalHotkey, setProfessionalHotkey, onSave, saved }: any) {
  const rows = [
    { label: 'Dictation Mode', desc: 'Standard voice-to-text', value: dictationHotkey, set: setDictationHotkey, color: '#7c6af7' },
    { label: 'Code Mode', desc: 'Voice-to-code with AI', value: codeHotkey, set: setCodeHotkey, color: '#f9ca24' },
    { label: 'Professional Mode', desc: 'Formal email / docs', value: professionalHotkey, set: setProfessionalHotkey, color: '#f368e0' },
  ]

  return (
    <div style={{ padding: '40px 48px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <SectionHeader title="Global Hotkeys" subtitle="Press these key combos from anywhere to start recording." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '20px', background: '#1a1a20', borderRadius: '10px', padding: '16px 20px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ width: '4px', height: '36px', borderRadius: '2px', background: r.color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#e8e8f0' }}>{r.label}</div>
              <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{r.desc}</div>
            </div>
            <input
              type="text"
              value={r.value}
              onChange={e => r.set(e.target.value)}
              style={{ width: '240px', padding: '8px 14px', background: '#0f0f14', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '7px', color: '#e8e8f0', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: '18px', fontSize: '12px', color: '#444' }}>Format: <code style={{ color: '#666' }}>CommandOrControl+Shift+D</code></div>
      <SaveButton onSave={onSave} saved={saved} />
    </div>
  )
}

function ApiKeysTab({ groqKeys, setGroqKeys, cerebrasKeys, setCerebrasKeys, onSave, saved }: any) {
  const update = (arr: string[], i: number, val: string) => arr.map((v: string, idx: number) => idx === i ? val : v)

  return (
    <div style={{ padding: '40px 48px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <SectionHeader title="API Keys" subtitle="Add your API keys. Multiple keys are used in round-robin rotation." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Groq */}
        <div style={{ background: '#1a1a20', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#ff4757', marginBottom: '4px' }}>Groq</div>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '14px' }}>Transcription + Dictation</div>
          {groqKeys.map((k: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="password" value={k} placeholder="gsk_..." onChange={e => setGroqKeys(update(groqKeys, i, e.target.value))}
                style={{ flex: 1, padding: '8px 12px', background: '#0f0f14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', color: '#e8e8f0', fontSize: '13px', outline: 'none' }} />
              {groqKeys.length > 1 && <button onClick={() => setGroqKeys(groqKeys.filter((_: any, idx: number) => idx !== i))}
                style={{ padding: '0 10px', background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.2)', borderRadius: '6px', color: '#ff4757', cursor: 'pointer', fontSize: '12px' }}>✕</button>}
            </div>
          ))}
          <button onClick={() => setGroqKeys([...groqKeys, ''])}
            style={{ marginTop: '4px', fontSize: '12px', background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', color: '#555', cursor: 'pointer', padding: '6px 12px', width: '100%' }}>
            + Add key
          </button>
        </div>

        {/* Cerebras */}
        <div style={{ background: '#1a1a20', borderRadius: '12px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#7c6af7', marginBottom: '4px' }}>Cerebras</div>
          <div style={{ fontSize: '11px', color: '#555', marginBottom: '14px' }}>Code Mode (ultra-fast)</div>
          {cerebrasKeys.map((k: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="password" value={k} placeholder="csk_..." onChange={e => setCerebrasKeys(update(cerebrasKeys, i, e.target.value))}
                style={{ flex: 1, padding: '8px 12px', background: '#0f0f14', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '6px', color: '#e8e8f0', fontSize: '13px', outline: 'none' }} />
              {cerebrasKeys.length > 1 && <button onClick={() => setCerebrasKeys(cerebrasKeys.filter((_: any, idx: number) => idx !== i))}
                style={{ padding: '0 10px', background: 'rgba(124,106,247,0.1)', border: '1px solid rgba(124,106,247,0.2)', borderRadius: '6px', color: '#7c6af7', cursor: 'pointer', fontSize: '12px' }}>✕</button>}
            </div>
          ))}
          <button onClick={() => setCerebrasKeys([...cerebrasKeys, ''])}
            style={{ marginTop: '4px', fontSize: '12px', background: 'transparent', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '6px', color: '#555', cursor: 'pointer', padding: '6px 12px', width: '100%' }}>
            + Add key
          </button>
        </div>
      </div>
      <SaveButton onSave={onSave} saved={saved} />
    </div>
  )
}
