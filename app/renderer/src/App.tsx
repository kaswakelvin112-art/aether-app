import { useState } from 'react'

const RETICLES = ['3D HUD', 'Wire cube', '2D box'] as const

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-edge p-4">
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-hud-dim">{title}</h2>
      {children}
    </section>
  )
}

export default function App() {
  const [alpha, setAlpha] = useState(0.15)
  const [reticle, setReticle] = useState<(typeof RETICLES)[number]>('3D HUD')

  return (
    <div className="grid h-full grid-cols-[320px_1fr] bg-void font-hud text-sm text-slate-200">
      {/* A. Control and configuration panel */}
      <aside className="flex flex-col overflow-y-auto border-r border-edge bg-panel">
        <header className="border-b border-edge p-4">
          <h1 className="text-lg font-bold tracking-[0.3em] text-hud">AETHER-3D</h1>
          <p className="text-[11px] text-slate-500">{window.aether.platform}</p>
        </header>

        <Panel title="Input feed">
          <select className="w-full rounded border border-edge bg-void p-2">
            <option>Webcam</option>
            <option>Video file</option>
            <option>Image</option>
          </select>
        </Panel>

        <Panel title="Smoothing alpha">
          <input
            type="range"
            min={0.01}
            max={1}
            step={0.01}
            value={alpha}
            onChange={(e) => setAlpha(Number(e.target.value))}
            className="w-full accent-hud"
          />
          <p className="mt-1 text-hud">{alpha.toFixed(2)}</p>
        </Panel>

        <Panel title="Reticle mode">
          <div className="grid grid-cols-3 gap-2">
            {RETICLES.map((r) => (
              <button
                key={r}
                onClick={() => setReticle(r)}
                className={`rounded border px-2 py-1.5 text-xs transition-colors ${
                  reticle === r
                    ? 'border-hud bg-hud/10 text-hud'
                    : 'border-edge text-slate-400 hover:border-hud-dim'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </Panel>

        <Panel title="Live telemetry">
          <dl className="grid grid-cols-2 gap-y-1 text-xs text-slate-400">
            <dt>Track</dt><dd className="text-hud">--</dd>
            <dt>Confidence</dt><dd className="text-hud">--</dd>
            <dt>Detector FPS</dt><dd className="text-hud">--</dd>
            <dt>Render FPS</dt><dd className="text-hud">--</dd>
          </dl>
        </Panel>
      </aside>

      {/* B + C. Viewport (top) and capture panel (bottom) */}
      <main className="grid min-w-0 grid-rows-[1fr_220px]">
        <section className="relative overflow-hidden bg-black">
          {/* Layer 1: <video>. Layer 2: transparent WebGL canvas (Phase 3). */}
          <div className="absolute inset-0 grid place-items-center text-slate-600">
            video layer
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