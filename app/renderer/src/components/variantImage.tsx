import { useEffect, useState } from 'react'
import type { ImageVariant } from './leftSidebar'

export default function VariantImage({ src, variant }: { src: string; variant: ImageVariant }) {
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

    const processImage = async () => {
      try {
        const sourceResponse = await fetch(src, { signal: controller.signal })
        const sourceBlob = await sourceResponse.blob()
        const imageData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.onerror = () => reject(new Error('Unable to read the selected image.'))
          reader.readAsDataURL(sourceBlob)
        })

        const response = await fetch('http://127.0.0.1:8765/process-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageData, variant }),
          signal: controller.signal
        })
        const result = await response.json() as { image?: string; error?: string }
        if (!response.ok || !result.image) {
          throw new Error(result.error ?? 'Python image processing failed.')
        }
        setProcessedSrc(result.image)
      } catch (reason) {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Python image processing failed.')
        }
      }
    }

    void processImage()
    return () => controller.abort()
  }, [src, variant])

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