
export type Capture = {
  id: string
  src: string
}

type BottomPreviewProps = {
  captures: Capture[]
  selectedCaptureId: string | null
  onSelect: (capture: Capture) => void
}

export default function BottomPreview({
  captures,
  selectedCaptureId,
  onSelect
}: BottomPreviewProps) {
  if (captures.length === 0) {
    return (
      <div className="grid flex-1 place-items-center rounded border border-dashed border-edge text-slate-600">
        no captures yet
      </div>
    )
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-6 gap-2 overflow-auto">
      {captures.map((capture, index) => (
        <button
          key={capture.id}
          type="button"
          onClick={() => onSelect(capture)}
          className={`min-h-0 overflow-hidden rounded border p-1 ${
            selectedCaptureId === capture.id
              ? 'border-hud bg-hud/10'
              : 'border-edge hover:border-hud-dim'
          }`}
          aria-label={`Select capture ${index + 1}`}
          aria-pressed={selectedCaptureId === capture.id}
        >
          <img
            src={capture.src}
            alt={`Capture ${index + 1}`}
            className="h-full w-full object-contain"
          />
        </button>
      ))}
    </div>
  )
}
