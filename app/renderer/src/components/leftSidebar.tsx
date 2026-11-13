
import { useState } from "react";
import MetaData from "./metaData";


const reticles = ['3D HUD', 'Wire cube', '2D box'] as const
export const VARIANTS = ["original", "gray", "binary", "blur", "sobel"] as const
export type ImageVariant = (typeof VARIANTS)[number]
export type Source = 'Image' | 'Video' | 'Live'

export type VariantParams = {
  binary: number
  blur: number
  sobel: number
}

const ImageActions = ['Filter', 'Spatial']

type LeftSidebarProps = {
    source: Source
    file: File | null
    onSourceChange: (source: Source) => void
    onFileChange: (file: File | null) => void
    variant: ImageVariant
    onVariantChange: (variant: ImageVariant) => void
    variantParams: VariantParams
    onVariantParamsChange: (params: VariantParams) => void
}

const LeftSideBar = ({ source, file, onSourceChange, onFileChange, variant, onVariantChange, variantParams, onVariantParamsChange }: LeftSidebarProps) => {
    const [alpha, setAlpha] = useState(0.15)
    const [reticle, setReticle] = useState<(typeof reticles)[number]>('3D HUD')
    const sourceFeed: Source[] = ['Image', 'Video', 'Live']

    const [imageActions, setImageActions] = useState<(typeof ImageActions)[number]>('Filter')

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
            <Slider 
                label='Smoothing alpha'
                 value={alpha} 
                 min={0} 
                 max={1}
                 step={0.01}
                 onChange={(e) => setAlpha(Number(e.target.value))}
            />
        
            <ul className="flex">
                {ImageActions.map((actions) => (
                    <li
                        key={actions}
                        className={`flex-1 border px-2 py-1.5 text-xs transition-colors ${
                            imageActions === actions
                                ? 'border-hud border-b-0 bg-hud/10 text-hud'
                                : 'border-edge text-slate-400 hover:border-hud-dim'
                        }`}
                    >
                        <button
                            type="button"
                            onClick={() => setImageActions(actions)}
                            className="w-full cursor-pointer"
                            aria-pressed={imageActions === actions}
                        >
                            {actions}
                        </button>
                    </li>
                ))}
            </ul>
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
            {imageActions === 'Filter' && 
                source === 'Image' && (<Panel title = "Variants">
                <div className="grid grid-cols-3 gap-2">
                    {VARIANTS.map((v) => (
                    <button
                        key={v}
                        onClick={() => onVariantChange(v)}
                        className={`cursor-pointer rounded border px-2 py-1.5 text-xs transition-colors ${
                        variant === v
                            ? 'border-hud bg-hud/10 text-hud'
                            : 'border-edge text-slate-400 hover:border-hud-dim'
                        }`}
                    >
                        {v}
                    </button>
                    ))}
                </div>
            </Panel>)}
            {variant === 'binary' && (
                <Slider 
                    label='Binary threshold'
                    value= {variantParams.binary}
                    min={0}
                    max={255}
                    step={1}
                    onChange={(e) => onVariantParamsChange({ ...variantParams, binary: parseInt(e.target.value) })}
                />
            )}
            {variant === 'blur' && (
                <Slider 
                    label='Blur kernel'
                    value= {variantParams.blur}
                    min={1}
                    max={31}
                    step={2}
                    onChange={(e) => onVariantParamsChange({ ...variantParams, blur: parseInt(e.target.value) })}
                />
            )}
            {variant === 'sobel' && (
                <Slider 
                    label='Sobel kernel'
                    value= {variantParams.sobel}
                    min={1}
                    max={7}
                    step={2}
                    onChange={(e) => onVariantParamsChange({ ...variantParams, sobel: parseInt(e.target.value) })}
                />
            )}
            <Panel title="Metadata">
                <MetaData file={source === 'Live' ? null : file} />
            </Panel>
        </aside>
    );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-edge p-4">
      <h2 className="mb-3 text-[11px] uppercase tracking-[0.2em] text-hud-dim">{title}</h2>
      {children}
    </section>
  )
}

type sliderProps = {
    label: string,
    value: number,
    min? : number ,
    max? : number ,
    step? : number ,
    onChange : (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function Slider({label,value,min=0,max=100,step=1,onChange}:sliderProps){
    return (
        <section className="border-b border-edge px-4 py-2">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-hud-dim">{label}</h2>
        <div className="flex gap-2">
            <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={onChange}
                    className="w-full accent-hud"
                />
                <p className="text-hud">{value.toFixed(2)}</p>
            </div>
        </section>
    )
}

export default LeftSideBar;