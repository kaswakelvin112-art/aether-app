import { useEffect, useState } from 'react';
import {
  getBasicMediaMetadata,
  getDeepImageMetadata,
  getDeepVideoMetadata,
  type MediaMetadata
} from '../net/meta-data';

export default function MetaData({ file }: { file: File | null }) {
  const [basicMetadata, setBasicMetadata] = useState<MediaMetadata | null>(null);
  const [deepMetadata, setDeepMetadata] = useState<MediaMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDeep, setShowDeep] = useState(false);

  useEffect(() => {
    setBasicMetadata(null);
    setDeepMetadata(null);
    setError(null);
    setShowDeep(false);
    if (!file) return;

    setLoading(true);
    getBasicMediaMetadata({ file })
      .then(setBasicMetadata)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unable to read image metadata.');
      })
      .finally(() => setLoading(false));
  }, [file]);

  const handleToggleDeepMetadata = async () => {
    if (!file) return;
    const nextShowDeep = !showDeep;
    setShowDeep(nextShowDeep);
    if (!nextShowDeep || deepMetadata) return;

    setLoading(true);
    setError(null);
    try {
      setDeepMetadata(
        await (file.type.startsWith('video/')
          ? getDeepVideoMetadata({ file })
          : getDeepImageMetadata({ file }))
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to read image metadata.');
    } finally {
      setLoading(false);
    }
  };

  const basicEntries = Object.entries(basicMetadata ?? {});
  const deepEntries = Object.entries(deepMetadata ?? {}).filter(
    ([label]) => !(label in (basicMetadata ?? {}))
  );

  return (
    <div className="p-4 text-xs text-slate-400">
      {!file && <p>No media selected</p>}
      {loading && <p>Reading metadata...</p>}
      {error && <p className="text-warn">{error}</p>}
      {file && !loading && basicEntries.map(([label, value]) => (
        value !== null && value !== undefined && (
          <div key={label} className="flex justify-between gap-3">
            <span>{label}</span>
            <span className="text-right text-slate-200">{String(value)}</span>
          </div>
        )
      ))}
      {file && !loading && basicEntries.length === 0 && !error && (
        <p>No metadata found</p>
      )}
      <div className={`toggle-transition ${showDeep ? 'toggle-transition-open' : ''}`}>
        <div className="min-h-0 overflow-hidden">
            {file && !loading && deepEntries.map(([label, value]) => (
          value !== null && value !== undefined && (
            <div key={label} className="flex justify-between gap-3">
              <span>{label}</span>
              <span className="text-right text-slate-200">{String(value)}</span>
            </div>
          )
        ))}
        </div>
      </div>
        <button
          type="button"
          hidden={!file}
          disabled={!file}
        aria-expanded={showDeep}
          className="mt-2 rounded border border-hud px-3 py-1.5 text-xs text-hud hover:bg-hud/10 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleToggleDeepMetadata}
        >
          {showDeep ? "Less" : "More"}
        </button>
        </div>
  )
}