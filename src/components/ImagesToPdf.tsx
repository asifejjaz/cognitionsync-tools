import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, FileImage } from 'lucide-react';
import type { OutputFile } from '../types';
import { loadImage } from '../lib/images';
import { imagesToPdf } from '../lib/pdfs';
import { errorMessage } from '../lib/files';
import { Field, Segmented } from './Controls';

export default function ImagesToPdf({
  files,
  busy,
  onRun,
  onError,
}: {
  files: File[];
  busy: boolean;
  onRun: (job: () => Promise<OutputFile[]>) => void;
  onError: (message: string) => void;
}) {
  const [ordered, setOrdered] = useState(files);
  const [previews, setPreviews] = useState<Map<File, string>>(new Map());
  const [paper, setPaper] = useState<'a4' | 'letter' | 'fit'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState(24);
  useEffect(() => {
    let cancelled = false;
    const loaded = new Map<File, string>();
    setOrdered(files);
    setPreviews(new Map());
    (async () => {
      for (const file of files) {
        const image = await loadImage(file, file.name);
        if (cancelled) {
          URL.revokeObjectURL(image.url);
          return;
        }
        loaded.set(file, image.url);
        setPreviews(new Map(loaded));
      }
    })().catch((error) => {
      if (!cancelled) onError(errorMessage(error));
    });
    return () => {
      cancelled = true;
      loaded.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [files]);
  function move(index: number, direction: number) {
    setOrdered((current) => {
      const next = [...current];
      const destination = index + direction;
      next.splice(destination, 0, next.splice(index, 1)[0]);
      return next;
    });
  }
  return (
    <div className="workbench">
      <div className="preview-column">
        <div className="panel-heading">
          <span>Page order</span>
          <span className="muted">{ordered.length} pages</span>
        </div>
        <div className="page-grid image-pages">
          {ordered.map((file, index) => (
            <div className="page-tile" key={`${file.name}-${index}`}>
              <div className="page-label">Page {index + 1}</div>
              <div className="pdf-thumbnail">
                {previews.get(file) ? (
                  <img src={previews.get(file)} alt={file.name} />
                ) : (
                  <FileImage size={30} />
                )}
              </div>
              <span className="page-filename">{file.name}</span>
              <div className="page-actions">
                <button
                  className="icon-button"
                  title="Move image left"
                  aria-label={`Move image ${index + 1} left`}
                  disabled={busy || index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowLeft size={15} />
                </button>
                <button
                  className="icon-button"
                  title="Move image right"
                  aria-label={`Move image ${index + 1} right`}
                  disabled={busy || index === ordered.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <aside className="settings-panel">
        <div className="panel-heading">
          <span>PDF settings</span>
        </div>
        <fieldset disabled={busy}>
          <Segmented
            label="Page size"
            value={paper}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
              { value: 'fit', label: 'Image' },
            ]}
            onChange={setPaper}
          />
          <Segmented
            label="Orientation"
            value={orientation}
            options={[
              { value: 'portrait', label: 'Portrait' },
              { value: 'landscape', label: 'Landscape' },
            ]}
            onChange={setOrientation}
          />
          <Field label={`Margins / ${margin} pt`}>
            <input
              type="range"
              min="0"
              max="72"
              value={margin}
              onChange={(event) => setMargin(Number(event.target.value))}
            />
          </Field>
        </fieldset>
        <button
          className="primary export-button"
          disabled={busy || previews.size !== files.length}
          onClick={() =>
            onRun(async () => [await imagesToPdf(ordered, paper, orientation, margin)])
          }
        >
          <ArrowRight size={17} />
          {busy ? 'Processing...' : 'Create PDF'}
        </button>
      </aside>
    </div>
  );
}
