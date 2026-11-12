import { useEffect, useRef, useState } from 'react'
import LeftSidebar, {Panel, type ImageVariant, type Source } from './components/leftSidebar'
import VariantImage from './components/variantImage'
import { useBackend, type LinkState } from './net/useBackend'


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
  }

  const handleSourceChange = (nextSource: Source) => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    setMediaUrl(null)
    setFile(null)
    setVariant('original')
    setSource(nextSource)
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
          onVariantChange={setVariant}
        />
        
      </aside>

      {/* B + C. Viewport (top) and capture panel (bottom) */}
      <main className="grid min-w-0 grid-rows-[1fr_220px]">
        <section className="relative overflow-hidden bg-black">
          {/* Layer 1: <video>. Layer 2: transparent WebGL canvas (Phase 3). */}
          <div className="absolute inset-0 grid place-items-center">
            {source === 'Image' && (
              <VariantImage
                src={mediaUrl ?? DEFAULT_IMAGE}
                variant={variant}
                processImage={backend.processImage}
              />
            )}
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
              <button className="rounded border border-hud px-3 py-1.5 text-xs text-hud hover:bg-hud/10">
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
          <div className="grid flex-1 place-items-center rounded border border-dashed border-edge text-slate-600">
            no captures yet
          </div>
        </section>
      </main>
    </div>
  )
}

