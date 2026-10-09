import { PDFDocument, degrees, rgb, StandardFonts, type PDFFont } from 'pdf-lib';
import type { Annotation, OutputFile, PageItem, PdfSource } from '../types';
import { basename } from './files';
import { transformImage } from './images';

export const pdfBlob = (bytes: Uint8Array) =>
  new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
let measurementFont: Promise<PDFFont> | undefined;
export async function annotationTextWidth(text: string, size: number) {
  measurementFont ??= PDFDocument.create().then((doc) => doc.embedFont(StandardFonts.Helvetica));
  try {
    return (await measurementFont).widthOfTextAtSize(text, size);
  } catch {
    throw new Error('PDF annotation text supports Latin characters in this release.');
  }
}
export function parsePageRanges(input: string, count: number): number[][] {
  if (!input.trim()) throw new Error('Enter page ranges, for example 1-3, 5, 7-9.');
  const parts = input.split(',');
  const result = parts.map((part) => {
    const match = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(part.trim());
    if (!match) throw new Error(`Invalid page range: ${part.trim() || '(empty)'}.`);
    const start = Number(match[1]),
      end = Number(match[2] || match[1]);
    if (start < 1 || end < start || end > count)
      throw new Error(`Pages must be between 1 and ${count}, in ascending ranges.`);
    return Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
  });
  return result;
}
export async function readPdf(file: File): Promise<PdfSource> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    throw new Error(`${file.name} is damaged or password protected. Open an unprotected PDF.`);
  }
  const pages = doc.getPageCount();
  if (!pages) throw new Error(`${file.name} has no pages. Choose a PDF with at least one page.`);
  if (pages > 100)
    throw new Error(
      `${file.name} has ${pages} pages. The first release supports up to 100 pages per PDF.`,
    );
  return { name: file.name, bytes, pages };
}
export async function arrangePdf(sources: PdfSource[], items: PageItem[]): Promise<OutputFile> {
  const kept = items.filter((item) => !item.excluded);
  if (!kept.length) throw new Error('Keep at least one page.');
  const output = await PDFDocument.create();
  const docs = await Promise.all(sources.map((source) => PDFDocument.load(source.bytes)));
  for (const item of kept) {
    const [page] = await output.copyPages(docs[item.fileIndex], [item.pageIndex]);
    page.setRotation(degrees((page.getRotation().angle + item.rotation + 360) % 360));
    output.addPage(page);
  }
  return {
    name: sources.length > 1 ? 'merged-filework.pdf' : `${basename(sources[0].name)}-organized.pdf`,
    blob: pdfBlob(await output.save()),
  };
}
export async function splitPdf(
  source: PdfSource,
  input: string,
  mode: 'ranges' | 'each' | 'extract',
): Promise<OutputFile[]> {
  const doc = await PDFDocument.load(source.bytes);
  const groups =
    mode === 'each'
      ? Array.from({ length: source.pages }, (_, i) => [i])
      : parsePageRanges(input, source.pages);
  const outputs: OutputFile[] = [];
  for (const [i, indexes] of (mode === 'extract' ? [groups.flat()] : groups).entries()) {
    const output = await PDFDocument.create();
    (await output.copyPages(doc, indexes)).forEach((page) => output.addPage(page));
    outputs.push({
      name: `${basename(source.name)}-${mode === 'each' ? `page-${indexes[0] + 1}` : `part-${i + 1}`}.pdf`,
      blob: pdfBlob(await output.save()),
    });
  }
  return outputs;
}
export async function imagesToPdf(
  files: File[],
  paper: 'a4' | 'letter' | 'fit',
  orientation: 'portrait' | 'landscape',
  margin: number,
): Promise<OutputFile> {
  if (!files.length) throw new Error('Choose at least one image.');
  const doc = await PDFDocument.create();
  for (const file of files) {
    const result = await transformImage(file, { format: 'jpeg', quality: 0.92 });
    const image = await doc.embedJpg(await result.blob.arrayBuffer());
    let width = paper === 'letter' ? 612 : 595.28,
      height = paper === 'letter' ? 792 : 841.89;
    if (paper === 'fit') {
      width = image.width * 0.75 + margin * 2;
      height = image.height * 0.75 + margin * 2;
    } else if (orientation === 'landscape') [width, height] = [height, width];
    const page = doc.addPage([width, height]);
    const ratio = Math.min(
      (width - margin * 2) / image.width,
      (height - margin * 2) / image.height,
    );
    const drawWidth = image.width * ratio,
      drawHeight = image.height * ratio;
    page.drawImage(image, {
      x: (width - drawWidth) / 2,
      y: (height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }
  return { name: 'images-filework.pdf', blob: pdfBlob(await doc.save()) };
}
export async function annotatePdf(
  source: PdfSource,
  annotations: Annotation[],
): Promise<OutputFile> {
  if (!annotations.length) throw new Error('Add a signature or text first.');
  const doc = await PDFDocument.load(source.bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const { getDocument } = await import('./pdf-render');
  const renderer = await getDocument(source.bytes);
  try {
    for (const annotation of annotations) {
      const page = doc.getPage(annotation.page);
      const renderedPage = await renderer.getPage(annotation.page + 1);
      const viewport = renderedPage.getViewport({ scale: 1 });
      const width = annotation.width * viewport.width,
        height = annotation.height * viewport.height;
      const x = annotation.x * viewport.width,
        y = annotation.y * viewport.height;
      if (annotation.kind === 'signature' && annotation.dataUrl) {
        const [px, py] = viewport.convertToPdfPoint(x, y + height);
        page.drawImage(await doc.embedPng(annotation.dataUrl), {
          x: px,
          y: py,
          width,
          height,
          rotate: degrees(viewport.rotation),
        });
      } else if (annotation.text) {
        const size = annotation.fontSize || 16;
        if (
          (await annotationTextWidth(annotation.text, size)) >
          viewport.width * (1 - annotation.x) + 0.01
        )
          throw new Error(
            'This text extends beyond the page. Shorten it or use a smaller text size.',
          );
        const [px, py] = viewport.convertToPdfPoint(x, y + size);
        const color = annotation.color || '#202328';
        try {
          page.drawText(annotation.text, {
            x: px,
            y: py,
            size,
            font,
            rotate: degrees(viewport.rotation),
            color: rgb(
              parseInt(color.slice(1, 3), 16) / 255,
              parseInt(color.slice(3, 5), 16) / 255,
              parseInt(color.slice(5, 7), 16) / 255,
            ),
          });
        } catch {
          throw new Error(
            'PDF text supports Latin characters in this release. Remove unsupported characters and retry.',
          );
        }
      }
    }
  } finally {
    await renderer.loadingTask.destroy();
  }
  return { name: `${basename(source.name)}-signed.pdf`, blob: pdfBlob(await doc.save()) };
}
