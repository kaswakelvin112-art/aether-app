
import { useState } from "react";


const reticles = ['3D HUD', 'Wire cube', '2D box'] as const
export type Source = 'Image' | 'Video' | 'Live'

type LeftSidebarProps = {
    source: Source
    onSourceChange: (source: Source) => void
    onFileChange: (file: File | null) => void
}

const LeftSideBar = ({ source, onSourceChange, onFileChange }: LeftSidebarProps) => {
    const [alpha, setAlpha] = useState(0.15)
    const [reticle, setReticle] = useState<(typeof reticles)[number]>('3D HUD')
    const sourceFeed: Source[] = ['Image', 'Video', 'Live']

    return (
        <aside>
            <ul id="source-feed" className="flex">
                {sourceFeed.map((feed) => (
                    <li
                        key={feed}
                        className={`flex-1 border px-2 py-1.5 text-xs transition-colors ${
                            source === feed
                                ? 'border-hud border-b-0 bg-hud/10 text-hud'
                                : 'border-edge text-slate-400 hover:border-hud-dim'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => onSourceChange(feed)}
                            className="w-full cursor-pointer"
                            aria-pressed={source === feed}
                        >
                            {feed}
                        </button>
                    </li>
                ))}
            </ul>
            <label className="block border-b border-edge p-4 text-xs text-slate-400">
                {source === 'Live' ? 'Camera input' : `Select ${source.toLowerCase()}`}
                <input
                    type="file"
                    accept={source === 'Image' ? 'image/*' : 'video/*'}
                    disabled={source === 'Live'}
                    onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                    className="mt-2 block w-full text-xs text-slate-400 file:mr-2 file:rounded file:border file:border-edge file:bg-void file:px-2 file:py-1 file:text-xs file:text-hud"
                    aria-label={source === 'Live' ? 'Camera input' : `Select ${source.toLowerCase()}`}
                />
            </label>
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
                    {reticles.map((r) => (
                    <button
                        key={r}
                        onClick={() => setReticle(r)}
                        className={`cursor-pointer rounded border px-2 py-1.5 text-xs transition-colors ${
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
            <Panel title="Metadata">
                <p className="text-xs text-slate-500">No metadata loaded</p>
            </Panel>
        </aside>
    );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-edge p-4">
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-hud-dim">{title}</h2>
      {children}
    </section>
  )
}


export default LeftSideBar;