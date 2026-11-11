import { useEffect, useState } from 'react'
import LeftSidebar, { type Source } from './components/leftSidebar'

const DEFAULT_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/3/3f/Placeholder_view_vector.svg'
const DEFAULT_VIDEO = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'

export default function App() {
  const [source, setSource] = useState<Source>('Image')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    }
  }, [mediaUrl])

  const handleFileChange = (file: File | null) => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    setMediaUrl(file ? URL.createObjectURL(file) : null)
  }

  const handleSourceChange = (nextSource: Source) => {
    if (mediaUrl) URL.revokeObjectURL(mediaUrl)
    setMediaUrl(null)
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
        <LeftSidebar
          source={source}
          onSourceChange={handleSourceChange}
          onFileChange={handleFileChange}
        />
        
      </aside>

      {/* B + C. Viewport (top) and capture panel (bottom) */}
      <main className="grid min-w-0 grid-rows-[1fr_220px]">
        <section className="relative overflow-hidden bg-black">
          {/* Layer 1: <video>. Layer 2: transparent WebGL canvas (Phase 3). */}
          <div className="absolute inset-0 grid place-items-center">
            {source === 'Image' && (
              <img
                src={mediaUrl ?? DEFAULT_IMAGE}
                alt="Selected source"
                className="max-h-full max-w-full object-contain"
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