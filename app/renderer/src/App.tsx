import { useCallback, useEffect, useState } from 'react'
import LeftSidebar, { Panel, type ImageVariant, type Source, type VariantParams } from './components/leftSidebar'
import VariantImage from './components/variantImage'
import { useBackend, type LinkState } from './net/useBackend'
import BottomPreview, { type Capture } from './components/bottomPreview'


const DEFAULT_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Placeholder_view_vector.svg'
const DEFAULT_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

const LINK_STYLE: Record<LinkState, { dot: string; label: string }> = {
  waiting: { dot: 'bg-warn', label: 'Starting backend' },
  connecting: { dot: 'bg-warn', label: 'Connecting' },
  connected: { dot: 'bg-emerald-400', label: 'Connected' },
  disconnected: { dot: 'bg-red-500', label: 'Disconnected' }
}

export default function App() {
  const [source, setSource] = useState<Source>('Image')
  const [file, setFile] = useState<File | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [variant, setVariant] = useState<ImageVariant>('original')
  const [variantParams, setVariantParams] = useState<VariantParams>({ binary: 128, blur: 5, sobel: 3 })
  const [currentImage, setCurrentImage] = useState<string | null>(null)
  const [captures, setCaptures] = useState<Capture[]>([])
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)

  const backend = useBackend()
  const link = LINK_STYLE[backend.link]
  const failed = backend.sidecar?.state === 'failed'

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    }
  }, [mediaUrl])

  const handleFileChange = (file: File | null) => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    setMediaUrl(file ? URL.createObjectURL(file) : null)
    setFile(file)
    setVariant('original')
    setVariantParams({ binary: 128, blur: 5, sobel: 3 })
    setCurrentImage(null)
    setSelectedCaptureId(null)

    if (file) {
      // Analyze image for optimal initial parameters
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = String(reader.result).split(',')[1]
          console.log('[App] Sending analyze request...')
          const params = await backend.analyzeImage(base64)
          console.log('[App] Got analyze params:', params)
          setVariantParams(params)
          console.log('[App] setVariantParams called')
        } catch (err) {
          console.warn('[App] Analyze failed, using defaults:', err)
        }
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSourceChange = (nextSource: Source) => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    setMediaUrl(null)
    setFile(null)
    setVariant('original')
    setVariantParams({ binary: 128, blur: 5, sobel: 3 })
    setCurrentImage(null)
    setSelectedCaptureId(null)
    setSource(nextSource)
  }

  const handleVariantChange = useCallback((nextVariant: ImageVariant) => {
    setVariant(nextVariant)
    setSelectedCaptureId(null)
  }, [])

  const handleCapture = async () => {
    if (!currentImage) return

    setCaptureError(null)
    let snapshot = currentImage
    if (!snapshot.startsWith('data:')) {
      const response = await fetch(snapshot)
      const blob = await response.blob()
      snapshot = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Unable to capture the current image.'))
        reader.readAsDataURL(blob)
      })
    }

    const capture = { id: crypto.randomUUID(), src: snapshot }
    setCaptures((previous) => [...previous, capture])
    setSelectedCaptureId(capture.id)
    setCurrentImage(snapshot)
  }

  return (
    <div className="grid h-full grid-cols-[320px_1fr] bg-void font-hud text-sm text-slate-200">
      {/* A. Control and configuration panel */}
      <aside className="flex flex-col overflow-y-auto border-r border-edge bg-panel">
        <header className="border-b border-edge p-4">
          <h1 className="text-lg font-bold tracking-[0.3em] text-hud">AETHER-3D</h1>
          <p className="text-[11px] text-slate-500">{window.aether.platform}</p>
        </header>
        <Panel title="Backend">
          <div className="mb-2 flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${link.dot}`} />
            <span className="text-slate-200">{link.label}</span>
          </div>
          <dl className="grid grid-cols-2 gap-y-1 text-xs text-slate-400">
            <dt>Sidecar</dt>
            <dd className="text-hud">{backend.sidecar?.state ?? '--'}</dd>
            <dt>Port</dt>
            <dd className="text-hud">{backend.sidecar?.port ?? '--'}</dd>
            <dt>Version</dt>
            <dd className="text-hud">{backend.backendVersion ?? '--'}</dd>
            <dt>Latency</dt>
            <dd className="text-hud">
              {backend.latencyMs === null ? '--' : `${backend.latencyMs.toFixed(1)} ms`}
            </dd>
          </dl>
          {backend.sidecar && backend.sidecar.state !== 'ready' && (
            <p className={`mt-2 text-xs ${failed ? 'text-red-400' : 'text-warn'}`}>
              {backend.sidecar.message}
            </p>
          )}
        </Panel>
        <LeftSidebar
          source={source}
          file={file}
          onSourceChange={handleSourceChange}
          onFileChange={handleFileChange}
          variant={variant}
          onVariantChange={handleVariantChange}
          variantParams={variantParams}
          onVariantParamsChange={setVariantParams}
        />
        
      </aside>

      {/* B + C. Viewport (top) and capture panel (bottom) */}
      <main className="grid min-w-0 grid-rows-[1fr_220px]">
        <section className="relative overflow-hidden bg-black">
          {/* Layer 1: <video>. Layer 2: transparent WebGL canvas (Phase 3). */}
          <div className="absolute inset-0 grid place-items-center">
            {source === 'Image' && selectedCaptureId !== null && currentImage ? (
              <img src={currentImage} alt="Selected capture" className="max-h-full max-w-full object-contain" />
            ) : source === 'Image' ? (
              <VariantImage
                src={mediaUrl ?? DEFAULT_IMAGE}
                variant={variant}
                processImage={backend.processImage}
                onDisplayedChange={setCurrentImage}
                variantParams={variantParams}
              />
            ) : null}
            {source === 'Video' && (
              <video
                src={mediaUrl ?? DEFAULT_VIDEO}
                autoPlay
                controls
                loop
                muted
                className="max-h-full max-w-full"
              />
            )}
            {source === 'Live' && (
              <p className="text-slate-600">Camera input is not connected</p>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 border border-hud/20">
            <span className="absolute left-3 top-3 text-[11px] tracking-[0.2em] text-hud">
              SPATIAL VIEWPORT
            </span>
          </div>
        </section>

        <section className="flex flex-col border-t border-edge bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-hud-dim">Capture history</h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleCapture().catch((reason) => {
                  setCaptureError(reason instanceof Error ? reason.message : 'Unable to capture the current image.')
                })}
                disabled={!currentImage}
                className="rounded border border-hud px-3 py-1.5 text-xs text-hud hover:bg-hud/10 disabled:cursor-not-allowed disabled:border-edge disabled:text-slate-600"
              >
                Capture
              </button>
              {['.PLY', '.OBJ', '.STL'].map((f) => (
                <button
                  key={f}
                  disabled
                  className="rounded border border-edge px-3 py-1.5 text-xs text-slate-600"
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          {captureError && <p className="mb-2 text-xs text-warn">{captureError}</p>}
          <BottomPreview
            captures={captures}
            selectedCaptureId={selectedCaptureId}
            onSelect={(capture) => {
              setSelectedCaptureId(capture.id)
              setCurrentImage(capture.src)
            }}
          />
        </section>
      </main>
    </div>
  )
}
