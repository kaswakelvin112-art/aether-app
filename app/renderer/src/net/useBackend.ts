import { useEffect, useState } from 'react'

export type LinkState = 'waiting' | 'connecting' | 'connected' | 'disconnected'

export interface BackendStatus {
  link: LinkState
  sidecar: SidecarInfo | null
  latencyMs: number | null
  backendVersion: string | null
}

const LOG_TAG = '[AETHER:net]'
const PING_INTERVAL_MS = 1000
const RECONNECT_DELAY_MS = 1000

interface ServerMessage {
  type?: string
  t?: number
  version?: string
}

export function useBackend(): BackendStatus {
  const [sidecar, setSidecar] = useState<SidecarInfo | null>(null)
  const [link, setLink] = useState<LinkState>('waiting')
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [backendVersion, setBackendVersion] = useState<string | null>(null)

  // 1. Track what the Electron main process says about the Python sidecar.
  useEffect(() => {
    let alive = true
    void window.aether.getSidecarInfo().then((info) => {
      if (alive) setSidecar(info)
    })
    const off = window.aether.onSidecarStatus((info) => setSidecar(info))
    return () => {
      alive = false
      off()
    }
  }, [])

  const state = sidecar?.state
  const port = sidecar?.port ?? null
  const token = sidecar?.token ?? null

  // 2. Whenever the sidecar is ready, open an authenticated WebSocket to it.
  useEffect(() => {
    if (state !== 'ready' || port === null || token === null) {
      setLink('waiting')
      setLatencyMs(null)
      return
    }

    let closed = false
    let ws: WebSocket | null = null
    let pingTimer: ReturnType<typeof setInterval> | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let smoothed: number | null = null

    const open = (): void => {
      setLink('connecting')
      const socket = new WebSocket(`ws://127.0.0.1:${port}`)
      socket.binaryType = 'arraybuffer'
      ws = socket

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'hello', token }))
      }

      socket.onmessage = (ev: MessageEvent) => {
        if (typeof ev.data !== 'string') return
        let msg: ServerMessage
        try {
          msg = JSON.parse(ev.data) as ServerMessage
        } catch {
          return
        }

        if (msg.type === 'hello_ack') {
          console.log(`${LOG_TAG} ✅ connected to backend v${msg.version}`)
          setLink('connected')
          setBackendVersion(msg.version ?? null)
          clearInterval(pingTimer)
          pingTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'ping', t: performance.now() }))
            }
          }, PING_INTERVAL_MS)
        } else if (msg.type === 'pong' && typeof msg.t === 'number') {
          const rtt = performance.now() - msg.t
          smoothed = smoothed === null ? rtt : smoothed * 0.8 + rtt * 0.2
          setLatencyMs(smoothed)
        }
      }

      socket.onclose = () => {
        clearInterval(pingTimer)
        if (closed) return
        console.warn(`${LOG_TAG} ⚠️ connection closed, retrying`)
        setLink('disconnected')
        setLatencyMs(null)
        retryTimer = setTimeout(open, RECONNECT_DELAY_MS)
      }

      socket.onerror = () => socket.close()
    }

    open()

    return () => {
      closed = true
      clearInterval(pingTimer)
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, [state, port, token])

  return { link, sidecar, latencyMs, backendVersion }
}