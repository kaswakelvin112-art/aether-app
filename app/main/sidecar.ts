import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { app, BrowserWindow } from 'electron'

const LOG_TAG = '[AETHER:sidecar]'
const READY_PREFIX = 'AETHER_READY '
const READY_TIMEOUT_MS = 20_000
const STABLE_AFTER_MS = 30_000
const STOP_GRACE_MS = 2_000
const MAX_RESTARTS = 5

export type SidecarState = 'starting' | 'ready' | 'restarting' | 'stopped' | 'failed'

// Keep in sync with the SidecarInfo type declared in renderer/src/env.d.ts
export interface SidecarInfo {
  state: SidecarState
  port: number | null
  token: string | null
  message: string
}

function appRoot(): string {
  // Dev: app.getAppPath() is <repo>/app, so the repo root is one level up.
  // Packaged: revisit if electron-builder changes the on-disk layout.
  return resolve(app.getAppPath(), '..')
}

function backendDir(): string {
  return resolve(appRoot(), 'backend')
}

function venvPythonCandidates(): string[] {
  const isWin = process.platform === 'win32'
  const rel = isWin
    ? join('.venv', 'Scripts', 'python.exe')
    : join('.venv', 'bin', 'python')
  const root = appRoot()
  return [
    resolve(root, 'backend', rel),
    resolve(root, rel),
    resolve(app.getAppPath(), rel)
  ]
}

function pythonExecutable(): string {
  const override = process.env['AETHER_PYTHON']?.trim()
  if (override) return override

  const candidates = venvPythonCandidates()
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  console.warn(
    `${LOG_TAG} ⚠️ no project venv found (looked in ${candidates.join(', ')}); falling back to system python`
  )
  return process.platform === 'win32' ? 'python' : 'python3'
}

class SidecarManager {
  private child: ChildProcess | null = null
  private info: SidecarInfo = { state: 'stopped', port: null, token: null, message: 'not started' }
  private stopping = false
  private restarts = 0
  private restartTimer: NodeJS.Timeout | null = null
  private readyTimer: NodeJS.Timeout | null = null
  private stableTimer: NodeJS.Timeout | null = null

  getInfo(): SidecarInfo {
    return this.info
  }

  start(): void {
    if (this.child) return
    this.stopping = false
    this.spawnChild()
  }

  async stop(): Promise<void> {
    this.stopping = true
    this.clearTimers()
    const child = this.child
    if (!child) {
      this.publish({ state: 'stopped', port: null, token: null, message: 'stopped' })
      return
    }
    await new Promise<void>((done) => {
      const force = setTimeout(() => {
        console.warn(`${LOG_TAG} ⚠️ backend ignored shutdown, force killing`)
        child.kill('SIGKILL')
      }, STOP_GRACE_MS)
      child.once('exit', () => {
        clearTimeout(force)
        done()
      })
      // EOF on stdin tells the Python backend to shut down cleanly.
      child.stdin?.end()
    })
    console.log(`${LOG_TAG} ✅ backend stopped`)
  }

  private clearTimers(): void {
    for (const t of [this.restartTimer, this.readyTimer, this.stableTimer]) {
      if (t) clearTimeout(t)
    }
    this.restartTimer = this.readyTimer = this.stableTimer = null
  }

  private publish(patch: Partial<SidecarInfo>): void {
    this.info = { ...this.info, ...patch }
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('sidecar:status', this.info)
    }
  }

  private spawnChild(): void {
    const dir = backendDir()
    const script = join(dir, 'server.py')
    if (!existsSync(script)) {
      console.error(`${LOG_TAG} ❌ server.py not found at ${script}`)
      this.publish({
        state: 'failed',
        port: null,
        token: null,
        message: `server.py not found at ${script}`
      })
      return
    }

    const token = randomBytes(24).toString('hex')
    const python = pythonExecutable()
    console.log(`${LOG_TAG} ⏭️ starting ${python} ${script}`)
    this.publish({
      state: this.restarts > 0 ? 'restarting' : 'starting',
      port: null,
      token: null,
      message: 'starting backend'
    })

    const child = spawn(python, ['-u', script], {
      cwd: dir,
      env: {
        ...process.env,
        AETHER_TOKEN: token,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8'
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    this.child = child

    this.readyTimer = setTimeout(() => {
      console.error(`${LOG_TAG} ❌ backend not ready after ${READY_TIMEOUT_MS / 1000}s, killing it`)
      child.kill()
    }, READY_TIMEOUT_MS)

    let buffer = ''
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', (chunk: string) => {
      buffer += chunk
      let idx = buffer.indexOf('\n')
      while (idx >= 0) {
        const line = buffer.slice(0, idx).replace(/\r$/, '')
        buffer = buffer.slice(idx + 1)
        this.onLine(line, token)
        idx = buffer.indexOf('\n')
      }
    })

    child.stderr?.setEncoding('utf8')
    child.stderr?.on('data', (chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (line) console.error(`${LOG_TAG} ❌ py: ${line}`)
      }
    })

    child.on('error', (err) => {
      console.error(`${LOG_TAG} ❌ spawn error: ${err.message}`)
      this.handleExit(child, null, null)
    })
    child.on('exit', (code, signal) => this.handleExit(child, code, signal))
  }

  private onLine(line: string, token: string): void {
    if (line.startsWith(READY_PREFIX)) {
      const port = Number(line.slice(READY_PREFIX.length).trim())
      if (Number.isInteger(port) && port > 0) {
        if (this.readyTimer) clearTimeout(this.readyTimer)
        this.readyTimer = null
        // Only forget past crashes once the backend has stayed up for a while.
        this.stableTimer = setTimeout(() => {
          this.restarts = 0
        }, STABLE_AFTER_MS)
        console.log(`${LOG_TAG} ✅ backend ready on port ${port}`)
        this.publish({ state: 'ready', port, token, message: 'backend ready' })
      }
      return
    }
    if (line) console.log(line)
  }

  private handleExit(child: ChildProcess, code: number | null, signal: NodeJS.Signals | null): void {
    if (this.child !== child) return
    this.child = null
    this.clearTimers()

    if (this.stopping) {
      this.publish({ state: 'stopped', port: null, token: null, message: 'stopped' })
      return
    }

    console.error(`${LOG_TAG} ⚠️ backend exited (code=${code}, signal=${signal})`)
    if (this.restarts >= MAX_RESTARTS) {
      console.error(`${LOG_TAG} ❌ giving up after ${MAX_RESTARTS} restarts`)
      this.publish({
        state: 'failed',
        port: null,
        token: null,
        message: `backend keeps crashing (gave up after ${MAX_RESTARTS} restarts), see the terminal`
      })
      return
    }

    const delay = Math.min(1000 * 2 ** this.restarts, 10_000)
    this.restarts += 1
    this.publish({
      state: 'restarting',
      port: null,
      token: null,
      message: `backend exited, restarting in ${delay / 1000}s (attempt ${this.restarts}/${MAX_RESTARTS})`
    })
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      if (!this.stopping) this.spawnChild()
    }, delay)
  }
}

export const sidecar = new SidecarManager()