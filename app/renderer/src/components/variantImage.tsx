import { useEffect, useState } from 'react'
import type { ImageVariant, VariantParams } from './leftSidebar'
import type { ProcessImage } from '../net/useBackend'

type VariantImageProps = {
  src: string
  variant: ImageVariant
  processImage: ProcessImage
  onDisplayedChange: (src: string) => void
  variantParams: VariantParams
}

export default function VariantImage({ src, variant, processImage, onDisplayedChange, variantParams }: VariantImageProps) {
  // What is currently on screen: null means the untouched source image.
  const [displayed, setDisplayed] = useState<string | null>(null)
  const [displayedVariant, setDisplayedVariant] = useState<ImageVariant>('original')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (variant === 'original') {
      setDisplayed(null)
      setDisplayedVariant('original')
      onDisplayedChange(src)
      setLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setError(null)
    setLoading(true)
    // Keep `displayed` as-is so the previous image stays up while the new one renders.

    const process = async () => {
      try {
        console.log('[VariantImage] Processing with params:', variantParams)
        const sourceResponse = await fetch(src, { signal: controller.signal })
        const sourceBlob = await sourceResponse.blob()
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('Unable to read the selected image.'))
          reader.readAsDataURL(sourceBlob)
        })

        // The sidecar accepts raw base64; strip the data: prefix if present.
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
        const result = await processImage(base64, variant, variantParams)
        console.log('[VariantImage] Got result, length:', result.length)
        if (controller.signal.aborted) return
        setDisplayed(`data:image/png;base64,${result}`)
        setDisplayedVariant(variant)
        onDisplayedChange(`data:image/png;base64,${result}`)
        setError(null)
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Image processing failed.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void process()
    return () => controller.abort()
  }, [src, variant, variantParams, processImage, onDisplayedChange])

  return (
    <div className="relative grid h-full w-full place-items-center">
      <img
        src={displayed ?? src}
        alt={displayedVariant === 'original' ? 'Selected source' : `${displayedVariant} image variant`}
        className="max-h-full max-w-full object-contain"
      />

      {loading && (
        <div className="variant-scanner" role="status" aria-busy="true">
          <div className="variant-laser" />
          <span className="sr-only">Processing {variant} variant…</span>
        </div>
      )}

      {error && !loading && (
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-void/80 px-2 py-1 text-xs text-warn">
          {error}
        </p>
      )}
    </div>
  )
}
