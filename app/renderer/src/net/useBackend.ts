import { useCallback, useEffect, useRef, useState } from 'react'
import type { VariantParams } from '../components/leftSidebar'

export type LinkState = 'waiting' | 'connecting' | 'connected' | 'disconnected'

export type ProcessImage = (imageBase64: string, variant: string, params?: Record<string, number>) => Promise<string>

export type AnalyzeImage = (imageBase64: string) => Promise<VariantParams>

export interface BackendStatus {
  link: LinkState
  sidecar: SidecarInfo | null
  latencyMs: number | null
  backendVersion: string | null
  processImage: ProcessImage
  analyzeImage: AnalyzeImage
}

const LOG_TAG = '[AETHER:net]'
const PING_INTERVAL_MS = 1000
const RECONNECT_DELAY_MS = 1000
const PROCESS_TIMEOUT_MS = 30_000

interface ServerMessage {
  type?: string
  id?: string
  t?: number
  version?: string
  image?: string
  message?: string
  params?: VariantParams
}

interface PendingRequest {
  resolve: (imageBase64: string) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let requestCounter = 0

function nextRequestId(): string {
  requestCounter += 1
  return `${Date.now().toString(36)}-${requestCounter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function useBackend(): BackendStatus {
  const [sidecar, setSidecar] = useState<SidecarInfo | null>(null)
  const [link, setLink] = useState<LinkState>('waiting')
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [backendVersion, setBackendVersion] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map())

  const rejectPending = useCallback((error: Error) => {
    for (const pending of pendingRef.current.values()) {
      clearTimeout(pending.timer)
      pending.reject(error)
    }
    pendingRef.current.clear()
  }, [])

  const processImage = useCallback(async (imageBase64: string, variant: string, params?: Record<string, number>): Promise<string> => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('backend is not connected')
    }

    const id = nextRequestId()
    console.log('[useBackend] Sending process-image with params:', params)
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pendingRef.current.delete(id)) {
          reject(new Error('image processing timed out'))
        }
      }, PROCESS_TIMEOUT_MS)
      pendingRef.current.set(id, { resolve, reject, timer })
      socket.send(JSON.stringify({ type: 'process-image', id, image: imageBase64, variant, params }))
    })
  }, [])

  const analyzeImage = useCallback(async (imageBase64: string): Promise<VariantParams> => {
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('backend is not connected')
    }

    const id = nextRequestId()
    console.log('[useBackend] Sending analyze-image, id:', id)
    return new Promise<VariantParams>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (pendingRef.current.delete(id)) {
          reject(new Error('analyze timed out'))
        }
      }, 10_000)
      pendingRef.current.set(id, { 
        resolve: (params: string) => {
          console.log('[useBackend] analyze resolve raw:', params)
          resolve(JSON.parse(params))
        }, 
        reject, 
        timer 
      })
      socket.send(JSON.stringify({ type: 'analyze-image', id, image: imageBase64 }))
    })
  }, [])

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
    let pingTimer: ReturnType<typeof setInterval> | undefined
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let smoothed: number | null = null

    const open = (): void => {
      setLink('connecting')
      const socket = new WebSocket(`ws://127.0.0.1:${port}`)
      socket.binaryType = 'arraybuffer'
      socketRef.current = socket

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'hello', token }))
      }

      socket.onmessage = (ev: MessageEvent) => {
        if (closed || typeof ev.data !== 'string') return
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
        } else if (msg.type === 'image_result' && typeof msg.id === 'string') {
          const pending = pendingRef.current.get(msg.id)
          if (!pending) return
          pendingRef.current.delete(msg.id)
          clearTimeout(pending.timer)
          if (typeof msg.image === 'string') {
            pending.resolve(msg.image)
          } else {
            pending.reject(new Error(msg.message ?? 'image processing failed'))
          }
        } else if (msg.type === 'image_error' && typeof msg.id === 'string') {
          const pending = pendingRef.current.get(msg.id)
          if (!pending) return
          pendingRef.current.delete(msg.id)
          clearTimeout(pending.timer)
          pending.reject(new Error(msg.message ?? 'image processing failed'))
        } else if (msg.type === 'analyze_result' && typeof msg.id === 'string') {
          const pending = pendingRef.current.get(msg.id)
          if (!pending) return
          pendingRef.current.delete(msg.id)
          clearTimeout(pending.timer)
          console.log('[useBackend] Received analyze_result:', msg.params)
          if (msg.params) {
            // Resolve with JSON string of params
            pending.resolve(JSON.stringify(msg.params))
          } else {
            pending.reject(new Error('analyze result missing params'))
          }
        } else if (msg.type === 'analyze_error' && typeof msg.id === 'string') {
          const pending = pendingRef.current.get(msg.id)
          if (!pending) return
          pendingRef.current.delete(msg.id)
          clearTimeout(pending.timer)
          console.warn('[useBackend] Received analyze_error:', msg.message)
          pending.reject(new Error(msg.message ?? 'analyze failed'))
        }
      }

      socket.onclose = () => {
        clearInterval(pingTimer)
        if (closed) return
        if (socketRef.current === socket) {
          socketRef.current = null
          rejectPending(new Error('backend disconnected'))
        }
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
      rejectPending(new Error('backend disconnected'))
      const socket = socketRef.current
      socketRef.current = null
      socket?.close()
    }
  }, [state, port, token, rejectPending])

  return { link, sidecar, latencyMs, backendVersion, processImage, analyzeImage }
}
