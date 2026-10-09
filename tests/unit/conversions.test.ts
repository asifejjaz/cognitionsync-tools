import { describe, it, expect } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { arrangePdf, parsePageRanges, readPdf, splitPdf } from '../../src/lib/pdfs';
import { basename, validateFiles, MAX_FILE_BYTES } from '../../src/lib/files';
import type { PageItem } from '../../src/types';

async function source() {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 3; i++)
    doc.addPage([300 + i * 10, 500]).setRotation(degrees(i === 1 ? 90 : 0));
  return readPdf(new File([new Uint8Array(await doc.save())], 'three.pdf'));
}
describe('page ranges', () => {
  it('uses zero-based indexes and preserves requested order', () =>
    expect(parsePageRanges('3, 1-2', 3)).toEqual([[2], [0, 1]]));
  it.each(['', '0', '4', '3-1', '1-', '1,,2', '1.5', '-1', 'one', '1-999999999'])(
    'rejects invalid range %s',
    (range) => expect(() => parsePageRanges(range, 3)).toThrow(),
  );
});
describe('PDF operations', () => {
  it('reorders, rotates, excludes pages, and preserves source rotation', async () => {
    const input = await source();
    const items: PageItem[] = [
      { id: '2', fileIndex: 0, pageIndex: 2, rotation: 90, excluded: false },
      { id: '0', fileIndex: 0, pageIndex: 0, rotation: 0, excluded: true },
      { id: '1', fileIndex: 0, pageIndex: 1, rotation: 90, excluded: false },
    ];
    const output = await arrangePdf([input], items);
    const doc = await PDFDocument.load(await output.blob.arrayBuffer());
    expect(doc.getPageCount()).toBe(2);
    expect(doc.getPages().map((page) => page.getWidth())).toEqual([320, 310]);
    expect(doc.getPages().map((page) => page.getRotation().angle)).toEqual([90, 180]);
  });
  it('merges separate documents in explicit page order', async () => {
    const input = await source();
    const output = await arrangePdf(
      [input, input],
      Array.from({ length: 6 }, (_, i) => ({
        id: String(i),
        fileIndex: Math.floor(i / 3),
        pageIndex: i % 3,
        rotation: 0,
        excluded: false,
      })),
    );
    expect((await PDFDocument.load(await output.blob.arrayBuffer())).getPageCount()).toBe(6);
  });
  it('splits ranges, each page, and extracts one PDF', async () => {
    const input = await source();
    const ranges = await splitPdf(input, '1-2,3', 'ranges');
    expect(
      await Promise.all(
        ranges.map(async (file) =>
          (await PDFDocument.load(await file.blob.arrayBuffer())).getPageCount(),
        ),
      ),
    ).toEqual([2, 1]);
    expect(await splitPdf(input, '', 'each')).toHaveLength(3);
    const [extracted] = await splitPdf(input, '3,1', 'extract');
    expect(
      (await PDFDocument.load(await extracted.blob.arrayBuffer()))
        .getPages()
        .map((page) => page.getWidth()),
    ).toEqual([320, 300]);
  });
  it('rejects corrupt inputs, empty output, and oversized page counts', async () => {
    await expect(readPdf(new File(['not a pdf'], 'bad.pdf'))).rejects.toThrow('damaged');
    await expect(arrangePdf([await source()], [])).rejects.toThrow('at least one');
    const doc = await PDFDocument.create();
    for (let i = 0; i < 101; i++) doc.addPage();
    await expect(readPdf(new File([new Uint8Array(await doc.save())], 'big.pdf'))).rejects.toThrow(
      '100 pages',
    );
  });
});
describe('file validation', () => {
  it('accepts supported case-insensitive extensions', () =>
    expect(() => validateFiles([new File(['test'], 'PHOTO.JPG')], '.jpg,.png')).not.toThrow());
  it('rejects unsupported, empty, too large, and too many files', () => {
    expect(() => validateFiles([new File(['test'], 'file.exe')], '.pdf')).toThrow('supported');
    expect(() => validateFiles([new File([], 'empty.pdf')], '.pdf')).toThrow('empty');
    expect(() =>
      validateFiles([new File([new Uint8Array(MAX_FILE_BYTES + 1)], 'large.pdf')], '.pdf'),
    ).toThrow('25 MB');
    expect(() =>
      validateFiles(
        Array.from({ length: 31 }, () => new File(['a'], 'a.pdf')),
        '.pdf',
      ),
    ).toThrow('30 files');
  });
  it('sanitizes download filenames', () => expect(basename('../bad:name.pdf')).toBe('.._bad_name'));
});
