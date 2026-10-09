import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export default function PdfThumbnail({
  document,
  index,
  rotation = 0,
}: {
  document?: PDFDocumentProxy;
  index: number;
  rotation?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false,
      render: RenderTask | undefined;
    setFailed(false);
    if (!document) return;
    document
      .getPage(index + 1)
      .then((page) => {
        if (cancelled || !canvas.current) return;
        const viewport = page.getViewport({
          scale: 0.27,
          rotation: (page.rotate + rotation + 360) % 360,
        });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        render = page.render({
          canvas: canvas.current,
          canvasContext: canvas.current.getContext('2d')!,
          viewport,
        });
        return render.promise;
      })
      .catch((error) => {
        if (!cancelled && error?.name !== 'RenderingCancelledException') setFailed(true);
      });
    return () => {
      cancelled = true;
      render?.cancel();
    };
  }, [document, index, rotation]);
  return (
    <div className="pdf-thumbnail">
      {(!document || failed) && <FileText size={30} />}
      <canvas ref={canvas} aria-label={`Page ${index + 1} preview`} />
    </div>
  );
}
