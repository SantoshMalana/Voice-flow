# VoiceFlow

**VoiceFlow** is a Windows desktop app for AI-assisted voice dictation. Press a global hotkey, speak, and get polished text on your clipboard—powered by [Groq](https://groq.com/) (Whisper + Llama) and optionally [Cerebras](https://www.cerebras.ai/) for fast code mode.

![Electron](https://img.shields.io/badge/Electron-31-47848f?logo=electron)
![React](https://img.shields.io/badge/React-18-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)

## Features

- **Dictation mode** — Clean up grammar from raw speech-to-text.
- **Code mode** — Turn spoken instructions into code or technical explanations (optimized for Cerebras when configured).
- **Professional mode** — Rewrite dictation into formal business tone.
- **System tray** — Runs in the background; close the window and keep hotkeys active.
- **HUD overlay** — Small always-on-top status while recording and processing.
- **Multiple API keys** — Round-robin across Groq (and Cerebras) keys to reduce rate-limit issues.

## Requirements

- **Windows** (build script targets `win32` x64).
- **Node.js** 18+ recommended.
- **Microphone** access when the app records.
- **Groq API key** at minimum (for Whisper transcription). Cerebras keys improve code mode latency.

## Quick start

1. **Clone the repository**

   ```bash
   git clone https://github.com/SantoshMalana/Voice-flow.git
   cd Voice-flow
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure API keys**

   - Copy `.env.example` to `.env` and fill in `GROQ_API_KEY` (and optionally `CEREBRAS_API_KEY`), **or**
   - Run the app and add keys under **API Keys** in the sidebar (saved to `%LOCALAPPDATA%\VoiceFlow\config.json`).

4. **Run in development**

   ```bash
   npm run dev
   ```

5. **Build a Windows folder** (see `package.json` — uses `electron-vite` + `@electron/packager`)

   ```bash
   npm run build
   ```

   Output is written under `dist/`.

## Default hotkeys

| Mode           | Default shortcut              |
|----------------|-------------------------------|
| Dictation      | `Ctrl+Shift+D`                |
| Code           | `Ctrl+Shift+C`                |
| Professional   | `Ctrl+Shift+E`                |

Hotkeys are configurable in the app (stored as strings like `CommandOrControl+Shift+D`). Press the same combo again to stop recording.

## Project layout

| Path | Role |
|------|------|
| `electron/main.ts` | Main process: tray, shortcuts, transcription, LLM polish, clipboard |
| `electron/preload.ts` | Exposes `window.voiceflow` to the renderer |
| `src/renderer/` | React UI (settings, home, hotkeys) |
| `src/renderer/hud.tsx` | Floating HUD window |
| `electron.vite.config.ts` | Vite / Electron build configuration |

## Tech stack

- [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/)
- [React](https://react.dev/) 18
- [groq-sdk](https://github.com/groq/groq-typescript) for Groq API and Cerebras (OpenAI-compatible base URL)

## Privacy

Audio is sent to Groq for transcription. Text may be sent to Groq and/or Cerebras depending on mode. API keys are stored locally—do not commit `.env` or share `config.json`.

## Scripts

| Command        | Description                    |
|----------------|--------------------------------|
| `npm run dev`  | Start dev server + Electron    |
| `npm run build` | Production build + packager  |
| `npm run preview` | Preview production build   |
| `npm run lint` | ESLint                         |

## License

MIT — see [LICENSE](LICENSE).

## Author

[SantoshMalana](https://github.com/SantoshMalana) — repository: [Voice-flow](https://github.com/SantoshMalana/Voice-flow).
