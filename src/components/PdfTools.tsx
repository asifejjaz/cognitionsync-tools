import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { ArrowLeft, ArrowRight, RotateCw, Trash2, Undo2, GripVertical } from 'lucide-react';
import type { OutputFile, PageItem, PdfSource, Tool } from '../types';
import { arrangePdf, readPdf, splitPdf } from '../lib/pdfs';
import { errorMessage } from '../lib/files';
import PdfThumbnail from './PdfThumbnail';
import { Field, Segmented } from './Controls';

export default function PdfTools({
  tool,
  files,
  busy,
  onRun,
  onError,
}: {
  tool: Tool;
  files: File[];
  busy: boolean;
  onRun: (job: () => Promise<OutputFile[]>) => void;
  onError: (error: string) => void;
}) {
  const [sources, setSources] = useState<PdfSource[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [renderers, setRenderers] = useState<PDFDocumentProxy[]>([]);
  const [ranges, setRanges] = useState('1');
  const [splitMode, setSplitMode] = useState<'ranges' | 'each' | 'extract'>('ranges');
  const [dragging, setDragging] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    const docs: PDFDocumentProxy[] = [];
    setSources([]);
    setPages([]);
    setRenderers([]);
    (async () => {
      const loaded = await Promise.all(files.map(readPdf));
      if (loaded.reduce((n, source) => n + source.pages, 0) > 150)
        throw new Error('This batch exceeds 150 pages. Merge fewer PDFs at a time.');
      const items = loaded.flatMap((source, fileIndex) =>
        Array.from({ length: source.pages }, (_, pageIndex) => ({
          id: `${fileIndex}-${pageIndex}`,
          fileIndex,
          pageIndex,
          rotation: 0,
          excluded: false,
        })),
      );
      if (cancelled) return;
      setSources(loaded);
      setPages(items);
      setRanges(loaded[0].pages > 1 ? `1-${loaded[0].pages}` : '1');
      const { getDocument } = await import('../lib/pdf-render');
      for (const source of loaded) {
        const doc = await getDocument(source.bytes);
        docs.push(doc);
        if (cancelled) {
          await doc.loadingTask.destroy();
          return;
        }
      }
      setRenderers([...docs]);
    })().catch((error) => {
      if (!cancelled) onError(errorMessage(error));
    });
    return () => {
      cancelled = true;
      docs.forEach((doc) => {
        void doc.loadingTask.destroy();
      });
    };
  }, [files]);
  function move(from: number, to: number) {
    if (to < 0 || to >= pages.length) return;
    setPages((current) => {
      const result = [...current];
      result.splice(to, 0, result.splice(from, 1)[0]);
      return result;
    });
  }
  const keptCount = pages.filter((page) => !page.excluded).length;
  return (
    <div className="workbench">
      <div className="preview-column">
        <div className="panel-heading">
          <span>Pages</span>
          <span className="muted">{pages.length} total</span>
        </div>
        {pages.length ? (
          <div className="page-grid">
            {pages.map((page, index) => (
              <div
                key={page.id}
                className={`page-tile ${page.excluded ? 'excluded' : ''}`}
                draggable={!busy && tool.id !== 'split-pdf'}
                onDragStart={() => setDragging(page.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragging && tool.id !== 'split-pdf')
                    move(
                      pages.findIndex((p) => p.id === dragging),
                      index,
                    );
                  setDragging(undefined);
                }}
              >
                <div className="page-label">
                  <GripVertical size={13} />
                  <span>Page {page.pageIndex + 1}</span>
                </div>
                <PdfThumbnail
                  document={renderers[page.fileIndex]}
                  index={page.pageIndex}
                  rotation={page.rotation}
                />
                <span className="page-filename" title={sources[page.fileIndex]?.name}>
                  {sources[page.fileIndex]?.name}
                </span>
                {tool.id !== 'split-pdf' && (
                  <div className="page-actions">
                    <button
                      className="icon-button"
                      title="Move page left"
                      aria-label={`Move page ${page.pageIndex + 1} left`}
                      disabled={busy || index === 0}
                      onClick={() => move(index, index - 1)}
                    >
                      <ArrowLeft size={14} />
                    </button>
                    <button
                      className="icon-button"
                      title="Move page right"
                      aria-label={`Move page ${page.pageIndex + 1} right`}
                      disabled={busy || index === pages.length - 1}
                      onClick={() => move(index, index + 1)}
                    >
                      <ArrowRight size={14} />
                    </button>
                    <button
                      className="icon-button"
                      title="Rotate page"
                      aria-label={`Rotate page ${page.pageIndex + 1}`}
                      disabled={busy}
                      onClick={() =>
                        setPages((current) =>
                          current.map((p) =>
                            p.id === page.id ? { ...p, rotation: (p.rotation + 90) % 360 } : p,
                          ),
                        )
                      }
                    >
                      <RotateCw size={14} />
                    </button>
                    <button
                      className="icon-button"
                      title={page.excluded ? 'Restore page' : 'Remove page'}
                      aria-label={`${page.excluded ? 'Restore' : 'Remove'} page ${page.pageIndex + 1}`}
                      disabled={busy}
                      onClick={() =>
                        setPages((current) =>
                          current.map((p) =>
                            p.id === page.id ? { ...p, excluded: !p.excluded } : p,
                          ),
                        )
                      }
                    >
                      {page.excluded ? <Undo2 size={14} /> : <Trash2 size={14} />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="loading">Opening pages...</div>
        )}
      </div>
      <aside className="settings-panel">
        <div className="panel-heading">
          <span>{tool.id === 'split-pdf' ? 'Split settings' : 'Document settings'}</span>
        </div>
        <fieldset disabled={busy}>
          {tool.id === 'split-pdf' ? (
            <>
              <Segmented
                label="Output"
                value={splitMode}
                options={[
                  { value: 'ranges', label: 'Ranges' },
                  { value: 'each', label: 'Each page' },
                  { value: 'extract', label: 'One PDF' },
                ]}
                onChange={setSplitMode}
              />
              {splitMode !== 'each' && (
                <Field
                  label="Page ranges"
                  hint={
                    splitMode === 'extract'
                      ? 'All selected pages are combined into one PDF.'
                      : 'Each comma-separated range creates a separate PDF.'
                  }
                >
                  <input
                    value={ranges}
                    placeholder="1-3, 5, 7-9"
                    onChange={(event) => setRanges(event.target.value)}
                  />
                </Field>
              )}
              <p className="settings-note">
                {splitMode === 'each'
                  ? 'One PDF per page, bundled in a ZIP when downloaded together.'
                  : 'Example: 1-3, 5 selects pages 1 through 3 and page 5.'}
              </p>
            </>
          ) : (
            <>
              <div className="document-summary">
                <span>
                  Source files<strong>{files.length}</strong>
                </span>
                <span>
                  Pages kept<strong>{keptCount}</strong>
                </span>
                <span>
                  Pages removed<strong>{pages.length - keptCount}</strong>
                </span>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  setPages(
                    sources.flatMap((source, fileIndex) =>
                      Array.from({ length: source.pages }, (_, pageIndex) => ({
                        id: `${fileIndex}-${pageIndex}`,
                        fileIndex,
                        pageIndex,
                        rotation: 0,
                        excluded: false,
                      })),
                    ),
                  )
                }
              >
                <Undo2 size={15} />
                Reset page changes
              </button>
            </>
          )}
        </fieldset>
        <button
          className="primary export-button"
          disabled={busy || !sources.length}
          onClick={() =>
            onRun(async () =>
              tool.id === 'split-pdf'
                ? splitPdf(sources[0], ranges, splitMode)
                : [await arrangePdf(sources, pages)],
            )
          }
        >
          <ArrowRight size={17} />
          {busy ? 'Processing...' : tool.action}
        </button>
      </aside>
    </div>
  );
}
