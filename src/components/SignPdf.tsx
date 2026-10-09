import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ArrowLeft, ArrowRight, Plus, Trash2 } from 'lucide-react';
import type { Annotation, OutputFile, PdfSource } from '../types';
import { annotatePdf, annotationTextWidth, readPdf } from '../lib/pdfs';
import { errorMessage } from '../lib/files';
import { Field } from './Controls';
import SignaturePad from './SignaturePad';

export default function SignPdf({
  file,
  busy,
  onRun,
  onError,
}: {
  file: File;
  busy: boolean;
  onRun: (job: () => Promise<OutputFile[]>) => void;
  onError: (message: string) => void;
}) {
  const [source, setSource] = useState<PdfSource>();
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 });
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selected, setSelected] = useState<string>();
  const [text, setText] = useState('Approved');
  const [fontSize, setFontSize] = useState(16);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pageBox = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | undefined>(undefined);
  useEffect(() => {
    let cancelled = false,
      loaded: PDFDocumentProxy | undefined;
    setAnnotations([]);
    setPage(0);
    setSource(undefined);
    setPdf(undefined);
    (async () => {
      const source = await readPdf(file);
      const { getDocument } = await import('../lib/pdf-render');
      loaded = await getDocument(source.bytes);
      if (cancelled) {
        await loaded.loadingTask.destroy();
        return;
      }
      setSource(source);
      setPdf(loaded);
    })().catch((error) => {
      if (!cancelled) onError(errorMessage(error));
    });
    return () => {
      cancelled = true;
      if (loaded) void loaded.loadingTask.destroy();
    };
  }, [file]);
  useEffect(() => {
    let cancelled = false,
      render: RenderTask | undefined;
    if (!pdf) return;
    pdf
      .getPage(page + 1)
      .then((current) => {
        if (cancelled || !canvas.current) return;
        const original = current.getViewport({ scale: 1 });
        setPageSize({ width: original.width, height: original.height });
        const viewport = current.getViewport({ scale: Math.min(1.5, 1000 / original.width) });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        render = current.render({
          canvas: canvas.current,
          canvasContext: canvas.current.getContext('2d')!,
          viewport,
        });
        return render.promise;
      })
      .catch((error) => {
        if (!cancelled && error?.name !== 'RenderingCancelledException')
          onError(errorMessage(error));
      });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [pdf, page]);
  function add(annotation: Omit<Annotation, 'id' | 'page'>) {
    const id = crypto.randomUUID();
    setAnnotations((current) => [...current, { ...annotation, id, page }]);
    setSelected(id);
  }
  function updateSelected(values: Partial<Annotation>) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === selected ? { ...annotation, ...values } : annotation,
      ),
    );
  }
  async function textWidth(value: string, size: number) {
    const width = (await annotationTextWidth(value, size)) / pageSize.width;
    if (width > 0.95)
      throw new Error(
        'This text is wider than the page. Shorten it or choose a smaller text size.',
      );
    return Math.max(0.02, width + 0.004);
  }
  const current = annotations.find((annotation) => annotation.id === selected);
  return (
    <div className="workbench sign-workbench">
      <div className="preview-column">
        <div className="panel-heading">
          <span>Document</span>
          <div className="navigation-controls">
            <button
              className="icon-button"
              title="Previous page"
              aria-label="Previous page"
              disabled={page === 0 || busy}
              onClick={() => {
                setPage(page - 1);
                setSelected(undefined);
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <span>
              {page + 1} / {source?.pages || '-'}
            </span>
            <button
              className="icon-button"
              title="Next page"
              aria-label="Next page"
              disabled={!source || page === source.pages - 1 || busy}
              onClick={() => {
                setPage(page + 1);
                setSelected(undefined);
              }}
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <div className="document-canvas-wrap">
          <div
            className="document-canvas"
            ref={pageBox}
            style={{ aspectRatio: `${pageSize.width} / ${pageSize.height}` }}
          >
            <canvas ref={canvas} aria-label="PDF page" />
            {annotations
              .filter((annotation) => annotation.page === page)
              .map((annotation) => (
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={`${annotation.kind} annotation`}
                  key={annotation.id}
                  className={`annotation ${selected === annotation.id ? 'selected' : ''}`}
                  style={{
                    left: `${annotation.x * 100}%`,
                    top: `${annotation.y * 100}%`,
                    width: `${annotation.width * 100}%`,
                    height: `${annotation.height * 100}%`,
                    fontSize: `calc(var(--page-width) * ${(annotation.fontSize || 16) / pageSize.width})`,
                  }}
                  onClick={() => setSelected(annotation.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setSelected(annotation.id);
                  }}
                  onPointerDown={(event) => {
                    if (busy || !pageBox.current) return;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setSelected(annotation.id);
                    const box = pageBox.current.getBoundingClientRect();
                    drag.current = {
                      id: annotation.id,
                      dx: (event.clientX - box.left) / box.width - annotation.x,
                      dy: (event.clientY - box.top) / box.height - annotation.y,
                    };
                  }}
                  onPointerMove={(event) => {
                    if (!drag.current || !pageBox.current) return;
                    const box = pageBox.current.getBoundingClientRect(),
                      { id, dx, dy } = drag.current;
                    setAnnotations((items) =>
                      items.map((item) =>
                        item.id === id
                          ? {
                              ...item,
                              x: Math.max(
                                0,
                                Math.min(
                                  1 - item.width,
                                  (event.clientX - box.left) / box.width - dx,
                                ),
                              ),
                              y: Math.max(
                                0,
                                Math.min(
                                  1 - item.height,
                                  (event.clientY - box.top) / box.height - dy,
                                ),
                              ),
                            }
                          : item,
                      ),
                    );
                  }}
                  onPointerUp={() => {
                    drag.current = undefined;
                  }}
                  onPointerCancel={() => {
                    drag.current = undefined;
                  }}
                >
                  {annotation.kind === 'signature' ? (
                    <img src={annotation.dataUrl} alt="Signature" draggable="false" />
                  ) : (
                    <span style={{ color: annotation.color }}>{annotation.text}</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
      <aside className="settings-panel">
        <div className="panel-heading">
          <span>Signature & text</span>
        </div>
        <fieldset disabled={busy}>
          <span className="field-label">Draw signature</span>
          <SignaturePad
            disabled={busy || !pdf}
            onAdd={(dataUrl) =>
              add({
                kind: 'signature',
                x: 0.15,
                y: 0.7,
                width: 0.32,
                height: (((0.32 * pageSize.width) / pageSize.height) * 220) / 600,
                dataUrl,
              })
            }
          />
          <Field label="Text">
            <input value={text} maxLength={120} onChange={(event) => setText(event.target.value)} />
          </Field>
          <Field label="Text size">
            <div className="input-unit">
              <input
                aria-label="Text size"
                type="number"
                min="8"
                max="48"
                value={fontSize}
                onChange={(event) =>
                  setFontSize(Math.max(8, Math.min(48, Number(event.target.value))))
                }
              />
              <span>pt</span>
            </div>
          </Field>
          <button
            className="secondary"
            disabled={!pdf || !text.trim()}
            onClick={async () => {
              try {
                const width = await textWidth(text, fontSize);
                add({
                  kind: 'text',
                  x: Math.min(0.15, 1 - width),
                  y: 0.15,
                  width,
                  height: (fontSize * 1.5) / pageSize.height,
                  text,
                  fontSize,
                  color: '#202328',
                });
              } catch (error) {
                onError(errorMessage(error));
              }
            }}
          >
            <Plus size={15} />
            Add text
          </button>
          {current && (
            <div className="annotation-settings">
              <span className="field-label">Selected {current.kind}</span>
              <Field label={`Horizontal position / ${Math.round(current.x * 100)}%`}>
                <input
                  aria-label="Horizontal position"
                  type="range"
                  min="0"
                  max={Math.floor((1 - current.width) * 100)}
                  value={current.x * 100}
                  onChange={(event) => updateSelected({ x: Number(event.target.value) / 100 })}
                />
              </Field>
              <Field label={`Vertical position / ${Math.round(current.y * 100)}%`}>
                <input
                  aria-label="Vertical position"
                  type="range"
                  min="0"
                  max={Math.floor((1 - current.height) * 100)}
                  value={current.y * 100}
                  onChange={(event) => updateSelected({ y: Number(event.target.value) / 100 })}
                />
              </Field>
              {current.kind === 'signature' ? (
                <Field label="Signature size">
                  <input
                    aria-label="Signature size"
                    type="range"
                    min="10"
                    max="60"
                    value={current.width * 100}
                    onChange={(event) => {
                      const width = Number(event.target.value) / 100,
                        height = (((width * pageSize.width) / pageSize.height) * 220) / 600;
                      updateSelected({
                        width,
                        height,
                        x: Math.min(current.x, 1 - width),
                        y: Math.min(current.y, 1 - height),
                      });
                    }}
                  />
                </Field>
              ) : (
                <Field label="Annotation text">
                  <input
                    value={current.text}
                    maxLength={120}
                    onChange={async (event) => {
                      const text = event.target.value;
                      try {
                        const width = await textWidth(text, current.fontSize || 16);
                        updateSelected({ text, width, x: Math.min(current.x, 1 - width) });
                      } catch (error) {
                        onError(errorMessage(error));
                      }
                    }}
                  />
                </Field>
              )}
              <button
                className="secondary danger"
                onClick={() => {
                  setAnnotations((items) => items.filter((item) => item.id !== selected));
                  setSelected(undefined);
                }}
              >
                <Trash2 size={15} />
                Remove annotation
              </button>
            </div>
          )}
          <p className="settings-note">
            Visible signatures only. This export does not create a certificate-based digital
            signature. Editing an already signed PDF may invalidate its existing signatures.
          </p>
        </fieldset>
        <button
          className="primary export-button"
          disabled={busy || !source || !annotations.length}
          onClick={() => onRun(async () => [await annotatePdf(source!, annotations)])}
        >
          <ArrowRight size={17} />
          {busy ? 'Processing...' : 'Save signed PDF'}
        </button>
      </aside>
    </div>
  );
}
