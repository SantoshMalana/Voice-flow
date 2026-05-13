import { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, nativeImage, clipboard } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as dotenv from 'dotenv'
import Groq, { toFile } from 'groq-sdk'

// Fix GPU cache errors: move userData out of OneDrive to a local path
const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local')
app.setPath('userData', path.join(localAppData, 'VoiceFlow'))

// Load .env from project root
dotenv.config({ path: path.join(app.getAppPath(), '.env') })
// Fallback: also try CWD-based .env
if (!process.env.GROQ_API_KEY) {
  dotenv.config({ path: path.join(process.cwd(), '.env') })
}

// --- Configuration Management ---
const configPath = path.join(app.getPath('userData'), 'config.json')

function loadConfig() {
  let conf = { 
    groqKeys: [] as string[], 
    cerebrasKeys: [] as string[],
    dictationHotkey: 'CommandOrControl+Shift+D',
    codeHotkey: 'CommandOrControl+Shift+C',
    professionalHotkey: 'CommandOrControl+Shift+E'
  }
  try {
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      conf = { ...conf, ...parsed }
    }
  } catch (e) {
    console.error('[VoiceFlow] Error loading config:', e)
  }
  
  // Migration: If config is empty but .env exists, migrate them
  if (conf.groqKeys.length === 0 && process.env.GROQ_API_KEY) {
    conf.groqKeys = [
      process.env.GROQ_API_KEY,
      process.env.GROQ_API_KEY_2,
      process.env.GROQ_API_KEY_3,
    ].filter(Boolean) as string[]
    
    conf.cerebrasKeys = [
      process.env.CEREBRAS_API_KEY,
      process.env.CEREBRAS_API_KEY_2,
      process.env.CEREBRAS_API_KEY_3,
    ].filter(Boolean) as string[]
    
    saveConfig(conf) // Save the migrated keys
  }
  
  return conf
}

function saveConfig(config: any) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    reloadApiPools(config)
    registerHotkey() // Re-register hotkeys when config is saved
  } catch (e) {
    console.error('[VoiceFlow] Error saving config:', e)
  }
}

// Global API Pools
let groqClients: Groq[] = []
let cerebrasClients: Groq[] = []
let groqClientIndex = 0
let cerebrasClientIndex = 0

function reloadApiPools(config: any) {
  const gKeys = config.groqKeys || []
  const cKeys = config.cerebrasKeys || []
  
  groqClients = gKeys.map((key: string) => new Groq({ apiKey: key }))
  cerebrasClients = cKeys.map((key: string) => new Groq({ 
    apiKey: key, 
    baseURL: 'https://api.cerebras.ai/v1' 
  }))
  
  if (groqClients.length === 0) console.warn('[VoiceFlow] No Groq API keys configured!')
  if (cerebrasClients.length === 0) console.warn('[VoiceFlow] No Cerebras API keys configured!')
}

// Initial load
const currentConfig = loadConfig()
reloadApiPools(currentConfig)

// Returns the next client in round-robin fashion
function getGroqClient(): Groq {
  if (groqClients.length === 0) throw new Error('No Groq API keys configured.')
  const client = groqClients[groqClientIndex % groqClients.length]
  groqClientIndex++
  return client
}

// Try an async operation across all clients until one succeeds
async function withGroqFallback<T>(operation: (client: Groq) => Promise<T>): Promise<T> {
  const errors: string[] = []
  for (let i = 0; i < groqClients.length; i++) {
    const client = groqClients[(groqClientIndex + i) % groqClients.length]
    try {
      const result = await operation(client)
      groqClientIndex = (groqClientIndex + i) % groqClients.length // Stick to working client
      return result
    } catch (err: any) {
      const msg = err?.message?.slice(0, 120) || String(err)
      errors.push(`Key${i + 1}: ${msg}`)
      console.warn(`[Groq] Client ${i + 1} failed:`, msg)
    }
  }
  throw new Error(`All ${groqClients.length} Groq API keys failed:\n${errors.join('\n')}`)
}

// IPC Handlers for Settings
ipcMain.handle('get-config', () => loadConfig())
ipcMain.handle('save-config', (_e, newConfig) => saveConfig(newConfig))

const TEMP_AUDIO = join(os.tmpdir(), 'voiceflow-audio.webm')

// Try an async operation across all Cerebras clients until one succeeds
async function withCerebrasFallback<T>(operation: (client: Groq) => Promise<T>): Promise<T> {
  if (cerebrasClients.length === 0) throw new Error('No Cerebras API keys found.')
  const errors: string[] = []
  for (let i = 0; i < cerebrasClients.length; i++) {
    const client = cerebrasClients[(cerebrasClientIndex + i) % cerebrasClients.length]
    try {
      const result = await operation(client)
      cerebrasClientIndex = (cerebrasClientIndex + i) % cerebrasClients.length // Stick to working client
      return result
    } catch (err: any) {
      const msg = err?.message?.slice(0, 120) || String(err)
      errors.push(`Cerebras Key${i + 1}: ${msg}`)
      console.warn(`[Cerebras] Client ${i + 1} failed:`, msg)
    }
  }
  throw new Error(`All ${cerebrasClients.length} Cerebras API keys failed:\n${errors.join('\n')}`)
}

let mainWindow: BrowserWindow | null = null
let hudWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isRecording = false
let recordingStartTime = 0
let hideTimeout: NodeJS.Timeout | null = null

type AppMode = 'dictation' | 'code' | 'professional'
let currentMode: AppMode = 'dictation'

function scheduleHide(ms = 2000) {
  if (hideTimeout) clearTimeout(hideTimeout)
  hideTimeout = setTimeout(() => {
    hudWindow?.webContents.send('status', 'idle')
    hudWindow?.webContents.send('transcript', '')
  }, ms)
}

function createMainWindow() {
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'voiceflow.ico')
    : join(app.getAppPath(), 'voiceflow.ico')

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: true, // Visible by default for welcoming UI
    skipTaskbar: false,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const url = process.env['ELECTRON_RENDERER_URL']
  if (url) {
    mainWindow.loadURL(url)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[VoiceFlow] Main window loaded successfully')
  })

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow?.hide()
  })
}

function createHudWindow() {
  hudWindow = new BrowserWindow({
    width: 320,
    height: 90,
    x: 20,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const url = process.env['ELECTRON_RENDERER_URL']
  if (url) {
    // Dev server: need to load the hud.html page
    hudWindow.loadURL(url + '/hud.html')
  } else {
    hudWindow.loadFile(join(__dirname, '../renderer/hud.html'))
  }

  hudWindow.setIgnoreMouseEvents(false)
  hudWindow.show() // Make it persistent instead of hidden
}

function createTray() {
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)

  const menu = Menu.buildFromTemplate([
    { label: 'VoiceFlow', enabled: false },
    { type: 'separator' },
    { label: 'Open Settings', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { label: 'Start Recording', click: () => startRecording() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.exit(0) },
  ])

  tray.setContextMenu(menu)
  tray.setToolTip('VoiceFlow — Ready to dictate')
  tray.on('click', () => { mainWindow?.show(); mainWindow?.focus() })
}

function registerHotkey() {
  globalShortcut.unregisterAll()

  const conf = loadConfig()
  let registered = false

  const registerMode = (key: string, mode: AppMode) => {
    if (!key) return
    const ret = globalShortcut.register(key, () => {
      console.log(`[VoiceFlow] Hotkey ${key} pressed! mode=`, mode, 'isRecording=', isRecording)
      if (isRecording) {
        stopRecording()
      } else {
        currentMode = mode
        startRecording()
      }
    })
    if (ret) {
      console.log(`[VoiceFlow] ✓ Hotkey registered: ${key} (${mode} mode)`)
      registered = true
    } else {
      console.warn(`[VoiceFlow] ✗ ${key} registration failed`)
    }
  }

  // Register the 3 core context modes
  registerMode(conf.dictationHotkey || 'CommandOrControl+Shift+D', 'dictation')
  registerMode(conf.codeHotkey || 'CommandOrControl+Shift+C', 'code')
  registerMode(conf.professionalHotkey || 'CommandOrControl+Shift+E', 'professional')

  if (!registered) {
    console.error('[VoiceFlow] ALL hotkeys failed! Use the tray menu to record.')
  }
}

function startRecording() {
  if (isRecording) return
  if (hideTimeout) clearTimeout(hideTimeout)
  isRecording = true
  recordingStartTime = Date.now()
  console.log('[VoiceFlow] >>> Recording started')
  mainWindow?.webContents.send('recording-state', true)
  hudWindow?.webContents.send('recording-state', true)
}

function stopRecording() {
  if (!isRecording) return
  const duration = Date.now() - recordingStartTime
  if (duration < 800) {
    console.warn(`[VoiceFlow] Recording too short (${duration}ms) — ignoring. Hold for at least 1 second.`)
    isRecording = false
    hudWindow?.webContents.send('recording-state', false)
    mainWindow?.webContents.send('recording-state', false)
    return
  }
  isRecording = false
  console.log(`[VoiceFlow] >>> Recording stopped after ${duration}ms — waiting for audio data...`)
  hudWindow?.webContents.send('recording-state', false)
  hudWindow?.webContents.send('status', 'processing')
  mainWindow?.webContents.send('recording-state', false)
}

async function transcribeAudioBuffer(audioBuffer: Buffer) {
  try {
    hudWindow?.webContents.send('status', 'processing')
    console.log('[VoiceFlow] Audio buffer size:', audioBuffer.length, 'bytes')

    if (audioBuffer.length < 1000) {
      console.error('[VoiceFlow] Audio too small — ignoring')
      hudWindow?.webContents.send('status', 'error')
      scheduleHide()
      return
    }

    // Validate WebM magic bytes: 0x1A 0x45 0xDF 0xA3
    const magic = Array.from(audioBuffer.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    const isWebM = audioBuffer[0] === 0x1A && audioBuffer[1] === 0x45 && audioBuffer[2] === 0xDF && audioBuffer[3] === 0xA3
    console.log(`[VoiceFlow] Magic bytes: ${magic} | Valid WebM: ${isWebM}`)

    if (!isWebM) {
      console.error('[VoiceFlow] Buffer is NOT a valid WebM file — skipping')
      hudWindow?.webContents.send('status', 'error')
      mainWindow?.webContents.send('transcript', '⚠️ Audio capture error: invalid format. Try again.')
      scheduleHide(3000)
      return
    }

    // Write to a unique temp file — a fresh fs.createReadStream is created per attempt
    // This avoids stream exhaustion when withGroqFallback retries across multiple clients
    const tempFile = path.join(os.tmpdir(), `vf_${Date.now()}.webm`)
    await fs.promises.writeFile(tempFile, audioBuffer)
    console.log('[VoiceFlow] Temp file written:', tempFile)

    let transcriptText = ''
    const whisperModels = ['whisper-large-v3-turbo', 'whisper-large-v3']

    for (const model of whisperModels) {
      let succeeded = false
      for (let k = 0; k < groqClients.length; k++) {
        try {
          console.log(`[VoiceFlow] Whisper ${model} via key ${k + 1}...`)
          // Fresh stream for EVERY attempt — never reuse a consumed stream
          const stream = fs.createReadStream(tempFile)
          const transcription = await groqClients[k].audio.transcriptions.create({
            file: stream,
            model,
            language: 'en'
          })
          transcriptText = transcription.text || ''
          console.log(`[Groq] ✓ Transcript (${model}, key${k + 1}):`, transcriptText)
          succeeded = true
          break
        } catch (err: any) {
          console.warn(`[Groq] ${model}/key${k + 1} failed:`, err?.message?.slice(0, 100))
        }
      }
      if (succeeded) break
    }

    // Clean up temp file
    fs.unlink(tempFile, () => {})

    if (!transcriptText.trim()) {
      console.error('[Groq] No transcript from any model or key')
      hudWindow?.webContents.send('status', 'error')
      mainWindow?.webContents.send('transcript', '⚠️ Whisper blocked. Enable at https://console.groq.com/settings/limits')
      scheduleHide(3000)
      return
    }

    await polishTranscript(transcriptText)

  } catch (error: any) {
    console.error('[Groq] Transcription error:', error?.message || error)
    hudWindow?.webContents.send('status', 'error')
    mainWindow?.webContents.send('transcript', `Error: ${error?.message || 'Transcription failed'}`)
    scheduleHide(3000)
  }
}

async function polishTranscript(rawText: string) {
  try {
    console.log(`[VoiceFlow] Polishing transcript in '${currentMode}' mode...`)
    
    let systemPrompt = 'You are an invisible dictation assistant. Fix grammatical errors in the transcribed text. Return ONLY the corrected text with no extra commentary or quotes.'
    let polishModels: string[] = []
    let useCerebras = false

    if (currentMode === 'code') {
      systemPrompt = `You are a Senior Software Engineer pair-programming with the user. The user is dictating instructions to you via voice. Your job is to fulfill their instruction completely.
RULES:
1. Treat the user's text as a COMMAND or QUESTION. Do not just format their words; ACT on them.
2. If they ask for an explanation (e.g., 'explain TypeScript vs JavaScript'), provide a thorough technical explanation with code examples.
3. If they ask you to write code, write the full, robust code snippet.
4. Return ONLY the markdown output (explanations and code blocks). Do not include conversational filler like 'Here is your code'.`
      polishModels = ['llama3.1-70b', 'llama3.1-8b']
      useCerebras = true // Always use Cerebras for code mode because it's insanely fast
    } else if (currentMode === 'professional') {
      systemPrompt = 'You are an executive assistant. Rewrite the following dictated text into a highly polished, professional, and formal tone suitable for business emails or documentation. Return ONLY the rewritten text without quotes.'
      polishModels = ['llama-3.3-70b-versatile', 'llama3.1-70b']
    } else {
      // Default dictation
      polishModels = ['llama-3.3-70b-versatile', 'llama3.1-8b']
    }

    let polished = rawText
    for (const model of polishModels) {
      try {
        console.log(`[VoiceFlow] Trying polish model: ${model}`)
        // Switch backend depending on model naming convention
        const isCerebrasModel = useCerebras || model.startsWith('llama3.1')
        
        const completionOp = (client: Groq) => client.chat.completions.create({
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: rawText }
          ],
          model,
          max_tokens: 1024,
        })

        const completion = isCerebrasModel 
          ? await withCerebrasFallback(completionOp)
          : await withGroqFallback(completionOp)

        polished = completion.choices[0]?.message?.content?.trim() || rawText
        console.log(`[${isCerebrasModel ? 'Cerebras' : 'Groq'}] ✓ Polished (${model}):`, polished)
        break
      } catch (err: any) {
        console.warn(`[VoiceFlow] Polish model ${model} failed:`, err?.message?.slice(0, 100))
      }
    }

    // Always deliver the result (raw or polished)
    mainWindow?.webContents.send('transcript', polished)
    hudWindow?.webContents.send('transcript', polished)
    hudWindow?.webContents.send('status', 'done')
    scheduleHide()
    clipboard.writeText(polished)
    console.log('[VoiceFlow] ✓ Copied to clipboard:', polished)

  } catch (error: any) {
    console.error('[Groq] Polish error:', error?.message || error)
    // Fallback: use raw text anyway
    mainWindow?.webContents.send('transcript', rawText)
    hudWindow?.webContents.send('status', 'done')
    clipboard.writeText(rawText)
    scheduleHide()
  }
}

// Audio pipeline: receive recorded audio from renderer
ipcMain.on('audio-data', (_e, audioArrayBuffer: ArrayBuffer) => {
  console.log('[VoiceFlow] Received audio-data IPC, size:', audioArrayBuffer?.byteLength || 0)
  const buffer = Buffer.from(audioArrayBuffer)
  transcribeAudioBuffer(buffer)
})

// Backup: receive raw text transcript directly
ipcMain.on('raw-transcript', (_e, rawText: string) => {
  console.log('[VoiceFlow] Received raw transcript:', rawText)
  if (rawText && rawText.trim()) {
    polishTranscript(rawText.trim())
  }
})

ipcMain.on('hide-hud', () => {
  hudWindow?.webContents.send('status', 'idle')
  hudWindow?.webContents.send('transcript', '')
})
ipcMain.on('show-settings', () => { mainWindow?.show(); mainWindow?.focus() })

app.whenReady().then(() => {
  console.log('[VoiceFlow] App ready. GROQ_API_KEY present:', !!process.env.GROQ_API_KEY)
  console.log('[VoiceFlow] App path:', app.getAppPath())

  createMainWindow()
  createHudWindow()
  createTray()
  registerHotkey()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => { /* keep in tray */ })
app.on('will-quit', () => { globalShortcut.unregisterAll() })
