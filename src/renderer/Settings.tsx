import React, { useState, useEffect } from 'react'

export default function Settings({ onClose }: { onClose?: () => void }) {
  const [groqKeys, setGroqKeys] = useState<string[]>([''])
  const [cerebrasKeys, setCerebrasKeys] = useState<string[]>([''])
  const [dictationHotkey, setDictationHotkey] = useState('CommandOrControl+Shift+D')
  const [codeHotkey, setCodeHotkey] = useState('CommandOrControl+Shift+C')
  const [professionalHotkey, setProfessionalHotkey] = useState('CommandOrControl+Shift+E')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load config on mount
    ;(window as any).voiceflow.getConfig().then((conf: any) => {
      if (conf) {
        if (conf.groqKeys?.length) setGroqKeys(conf.groqKeys)
        if (conf.cerebrasKeys?.length) setCerebrasKeys(conf.cerebrasKeys)
        if (conf.dictationHotkey) setDictationHotkey(conf.dictationHotkey)
        if (conf.codeHotkey) setCodeHotkey(conf.codeHotkey)
        if (conf.professionalHotkey) setProfessionalHotkey(conf.professionalHotkey)
      }
    })
  }, [])

  const handleSave = async () => {
    const config = {
      groqKeys: groqKeys.filter(k => k.trim() !== ''),
      cerebrasKeys: cerebrasKeys.filter(k => k.trim() !== ''),
      dictationHotkey,
      codeHotkey,
      professionalHotkey
    }
    await (window as any).voiceflow.saveConfig(config)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    if (onClose) setTimeout(onClose, 500)
  }

  const handleArrayChange = (setter: any, arr: string[], index: number, val: string) => {
    const newArr = [...arr]
    newArr[index] = val
    setter(newArr)
  }

  const addKey = (setter: any, arr: string[]) => setter([...arr, ''])
  const removeKey = (setter: any, arr: string[], index: number) => setter(arr.filter((_, i) => i !== index))

  return (
    <div style={{ padding: 40, color: '#fff', maxWidth: 600, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: 30, fontSize: 28 }}>VoiceFlow Settings</h1>
      
      <div style={{ marginBottom: 30, background: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 12 }}>
        <h3 style={{ marginTop: 0, color: '#ff4757' }}>Groq API Keys</h3>
        <p style={{ fontSize: 13, color: '#aaa' }}>Used for Dictation mode & Audio Transcription.</p>
        {groqKeys.map((key, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input 
              type="password"
              value={key}
              placeholder="gsk_..."
              onChange={e => handleArrayChange(setGroqKeys, groqKeys, i, e.target.value)}
              style={{ flex: 1, padding: '10px 15px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
            />
            <button onClick={() => removeKey(setGroqKeys, groqKeys, i)} style={{ padding: '0 15px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>X</button>
          </div>
        ))}
        <button onClick={() => addKey(setGroqKeys, groqKeys)} style={{ marginTop: 10, padding: '8px 15px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>+ Add Groq Key</button>
      </div>

      <div style={{ marginBottom: 30, background: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 12 }}>
        <h3 style={{ marginTop: 0, color: '#7c6af7' }}>Cerebras API Keys</h3>
        <p style={{ fontSize: 13, color: '#aaa' }}>Used for ultra-fast Code Mode & Logic.</p>
        {cerebrasKeys.map((key, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <input 
              type="password"
              value={key}
              placeholder="csk_..."
              onChange={e => handleArrayChange(setCerebrasKeys, cerebrasKeys, i, e.target.value)}
              style={{ flex: 1, padding: '10px 15px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.3)', color: '#fff' }}
            />
            <button onClick={() => removeKey(setCerebrasKeys, cerebrasKeys, i)} style={{ padding: '0 15px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer' }}>X</button>
          </div>
        ))}
        <button onClick={() => addKey(setCerebrasKeys, cerebrasKeys)} style={{ marginTop: 10, padding: '8px 15px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>+ Add Cerebras Key</button>
      </div>

      <div style={{ marginBottom: 30, background: 'rgba(255,255,255,0.05)', padding: 20, borderRadius: 12 }}>
        <h3 style={{ marginTop: 0, color: '#f368e0' }}>Global Hotkeys</h3>
        <p style={{ fontSize: 13, color: '#aaa' }}>Use 'CommandOrControl', 'Shift', 'Alt' combined with keys (e.g., 'CommandOrControl+Shift+D').</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginTop: 15 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 13, color: '#ddd' }}>Dictation Mode</label>
            <input 
              type="text" value={dictationHotkey} onChange={e => setDictationHotkey(e.target.value)}
              style={{ width: '100%', padding: '10px 15px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.3)', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 13, color: '#ddd' }}>Code Mode</label>
            <input 
              type="text" value={codeHotkey} onChange={e => setCodeHotkey(e.target.value)}
              style={{ width: '100%', padding: '10px 15px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.3)', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 5, fontSize: 13, color: '#ddd' }}>Professional Mode</label>
            <input 
              type="text" value={professionalHotkey} onChange={e => setProfessionalHotkey(e.target.value)}
              style={{ width: '100%', padding: '10px 15px', borderRadius: 6, border: 'none', background: 'rgba(0,0,0,0.3)', color: '#fff', boxSizing: 'border-box' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
        <button onClick={handleSave} style={{ padding: '12px 30px', background: '#7c6af7', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', fontSize: 16 }}>
          Save Configuration
        </button>
        {saved && <span style={{ color: '#7bed9f' }}>✓ Saved successfully!</span>}
      </div>
    </div>
  )
}
