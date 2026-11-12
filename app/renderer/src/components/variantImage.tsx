import { useEffect, useState } from 'react'
import type { ImageVariant } from './leftSidebar'
import type { ProcessImage } from '../net/useBackend'

type VariantImageProps = {
  src: string
  variant: ImageVariant
  processImage: ProcessImage
}

export default function VariantImage({ src, variant, processImage }: VariantImageProps) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (variant === 'original') {
      setProcessedSrc(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    setError(null)
    setProcessedSrc(null)

    const process = async () => {
      try {
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
        const result = await processImage(base64, variant)
        setProcessedSrc(`data:image/png;base64,${result}`)
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Image processing failed.')
        }
      }
    }

    void process()
    return () => controller.abort()
  }, [src, variant, processImage])

  if (variant === 'original') {
    return <img src={src} alt="Selected source" className="max-h-full max-w-full object-contain" />
  }

  if (error) {
    return <p className="text-warn">{error}</p>
  }

  return (
    <img
      src={processedSrc ?? src}
      alt={`${variant} image variant`}
      className="max-h-full max-w-full object-contain"
    />
  )
}
