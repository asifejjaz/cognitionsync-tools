import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

const fixture = (name: string) => path.resolve('public/samples', name);
async function upload(page: Page, slug: string, files: string[]) {
  await page.goto(`/tools/${slug}`);
  await page.locator('input[type=file]').first().setInputFiles(files.map(fixture));
}
async function result(page: Page, action: string) {
  await page.getByRole('button', { name: action, exact: true }).click();
  await expect(page.getByRole('region', { name: 'Results' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
}
async function download(page: Page, index = 0) {
  const wait = page.waitForEvent('download');
  await page
    .getByRole('region', { name: 'Results' })
    .locator('.result-row')
    .getByRole('button', { name: /^Download / })
    .nth(index)
    .click();
  const file = await wait;
  return { bytes: await readFile((await file.path())!), name: file.suggestedFilename() };
}
async function dimensions(page: Page, bytes: Buffer) {
  return page.evaluate(
    async (data) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
      const size = [bitmap.width, bitmap.height];
      bitmap.close();
      return size;
    },
    [...bytes],
  );
}

test('image compressor enforces the byte budget and supports batch ZIP', async ({ page }) => {
  await upload(page, 'compress-image', ['woodland.jpg', 'woodland.jpg']);
  await page.getByRole('spinbutton', { name: 'Maximum file size' }).fill('50');
  await result(page, 'Compress images');
  const file = await download(page, 1);
  expect(file.bytes.length).toBeLessThanOrEqual(50 * 1024);
  expect(await dimensions(page, file.bytes)).toHaveLength(2);
  const wait = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download all', exact: true }).click();
  const zip = await JSZip.loadAsync(await readFile((await (await wait).path())!));
  expect(Object.keys(zip.files)).toEqual(['woodland-filework.jpg', 'woodland-filework-2.jpg']);
});
test('resize uses exact dimensions, rejects zero, and crop keeps square aspect', async ({
  page,
}) => {
  await upload(page, 'resize-image', ['woodland.jpg']);
  await expect(page.getByRole('button', { name: 'Export images' })).toBeEnabled();
  await page.getByRole('button', { name: 'Unlock aspect ratio' }).click();
  await page.getByRole('spinbutton', { name: 'Width', exact: true }).fill('320');
  await page.getByRole('spinbutton', { name: 'Height', exact: true }).fill('240');
  await result(page, 'Export images');
  expect(await dimensions(page, (await download(page)).bytes)).toEqual([320, 240]);
  await page.getByRole('spinbutton', { name: 'Width', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Export images' }).click();
  await expect(page.getByRole('alert')).toContainText('dimensions');
  await page.getByRole('spinbutton', { name: 'Width', exact: true }).fill('300');
  await page.getByRole('button', { name: 'Crop', exact: true }).click();
  await page.getByLabel('Aspect ratio', { exact: true }).selectOption('1');
  await expect(page.getByRole('spinbutton', { name: 'Height', exact: true })).toHaveValue('300');
  await result(page, 'Export images');
  expect(await dimensions(page, (await download(page)).bytes)).toEqual([300, 300]);
});
test('HEIC decodes a real fixture to JPG and PNG', async ({ page }) => {
  await upload(page, 'heic-to-jpg', ['example.heic']);
  await result(page, 'Convert images');
  const jpg = await download(page);
  expect(jpg.bytes.subarray(0, 2).toString('hex')).toBe('ffd8');
  const size = await dimensions(page, jpg.bytes);
  expect(size[0]).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'PNG', exact: true }).click();
  await result(page, 'Convert images');
  expect((await download(page)).bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});
test('WebP exports real WebP and converts it back to PNG', async ({ page }) => {
  await upload(page, 'webp-converter', ['woodland.jpg']);
  await page.getByRole('button', { name: 'WebP', exact: true }).click();
  await result(page, 'Convert images');
  const file = await download(page);
  expect(file.bytes.subarray(8, 12).toString()).toBe('WEBP');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'image.webp', mimeType: 'image/webp', buffer: file.bytes });
  await page.getByRole('button', { name: 'PNG', exact: true }).click();
  await result(page, 'Convert images');
  expect((await download(page, 1)).bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});
test('photo and signature preparation respects dimensions and budgets', async ({ page }) => {
  await upload(page, 'photo-signature', ['woodland.jpg']);
  await result(page, 'Prepare image');
  const photo = await download(page);
  expect(photo.bytes.length).toBeLessThanOrEqual(100 * 1024);
  expect(await dimensions(page, photo.bytes)).toEqual([600, 800]);
  await page.getByRole('button', { name: 'Signature', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Maximum file size' }).fill('500');
  await result(page, 'Prepare image');
  const signature = await download(page);
  expect(signature.name).toMatch(/\.png$/);
  expect(await dimensions(page, signature.bytes)).toEqual([600, 200]);
  await page.getByRole('spinbutton', { name: 'Height', exact: true }).fill('0');
  await page.getByRole('button', { name: 'Prepare image', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('dimensions');
});
test('images become ordered landscape PDF pages', async ({ page }) => {
  await upload(page, 'jpg-to-pdf', ['woodland.jpg', 'woodland.jpg']);
  await page.getByRole('button', { name: 'Landscape', exact: true }).click();
  await page.getByRole('button', { name: 'Move image 2 left' }).click();
  await result(page, 'Create PDF');
  const doc = await PDFDocument.load((await download(page)).bytes);
  expect(doc.getPageCount()).toBe(2);
  expect(doc.getPage(0).getWidth()).toBeGreaterThan(doc.getPage(0).getHeight());
});
test('merge produces six pages; organize preserves explicit rotation and order', async ({
  page,
}) => {
  await upload(page, 'merge-pdf', ['project-notes.pdf', 'project-notes.pdf']);
  await result(page, 'Merge PDFs');
  expect((await PDFDocument.load((await download(page)).bytes)).getPageCount()).toBe(6);
  await upload(page, 'organize-pdf', ['project-notes.pdf']);
  await page.getByRole('button', { name: 'Rotate page 1', exact: true }).click();
  await page.getByRole('button', { name: 'Move page 1 right', exact: true }).click();
  await page.getByRole('button', { name: 'Remove page 3', exact: true }).click();
  await result(page, 'Save PDF');
  const doc = await PDFDocument.load((await download(page)).bytes);
  expect(doc.getPageCount()).toBe(2);
  expect(doc.getPages().map((p) => p.getRotation().angle)).toEqual([0, 90]);
});
test('split validates ranges and exports PDF ranges or ZIP', async ({ page }) => {
  await upload(page, 'split-pdf', ['project-notes.pdf']);
  await page.getByLabel('Page ranges').fill('0-8');
  await page.getByRole('button', { name: 'Split PDF', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('between 1 and 3');
  await page.getByLabel('Page ranges').fill('1-2,3');
  await result(page, 'Split PDF');
  expect((await PDFDocument.load((await download(page)).bytes)).getPageCount()).toBe(2);
  expect((await PDFDocument.load((await download(page, 1)).bytes)).getPageCount()).toBe(1);
  await page.getByRole('button', { name: 'Each page', exact: true }).click();
  await result(page, 'Split PDF');
  await expect(page.locator('.result-row')).toHaveCount(3);
});
test('visible signature and text export on rotated and cropped PDF pages', async ({ page }) => {
  await upload(page, 'sign-pdf', ['rotated-cropped.pdf']);
  await expect(page.getByRole('button', { name: 'Add text', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  const box = await page.getByLabel('Draw signature', { exact: true }).boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 20, box!.y + 30);
  await page.mouse.down();
  await page.mouse.move(box!.x + 80, box!.y + 50, { steps: 12 });
  await page.mouse.move(box!.x + 140, box!.y + 20, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Add signature', exact: true }).click();
  await page.getByRole('button', { name: 'Next page' }).click();
  await page.getByRole('button', { name: 'Add text', exact: true }).click();
  await result(page, 'Save signed PDF');
  const file = await download(page);
  const doc = await PDFDocument.load(file.bytes);
  expect(doc.getPageCount()).toBe(3);
  expect(doc.getPage(0).getRotation().angle).toBe(90);
  const text = await page.evaluate(
    async (data) => {
      // @ts-expect-error Vite serves source modules to the browser test.
      const { getDocument } = await import('/src/lib/pdf-render.ts');
      const pdf = await getDocument(new Uint8Array(data));
      const pages = await Promise.all(
        [1, 2].map(async (n) => {
          const page = await pdf.getPage(n),
            viewport = page.getViewport({ scale: 1 });
          const items = (await page.getTextContent()).items;
          const approved = items.find((item: { str?: string }) => item.str === 'Approved');
          return {
            text: items.map((item: { str?: string }) => item.str || '').join(' '),
            point: viewport.convertToViewportPoint(approved.transform[4], approved.transform[5]),
            expected: [viewport.width * 0.15, viewport.height * 0.15 + 16],
          };
        }),
      );
      const page = await pdf.getPage(1),
        viewport = page.getViewport({ scale: 1 });
      const canvas = document.createElement('canvas');
      canvas.id = 'exported-pdf';
      Object.assign(canvas.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        zIndex: '999',
        background: 'white',
      });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext('2d'), viewport }).promise;
      document.body.append(canvas);
      await pdf.loadingTask.destroy();
      return pages;
    },
    [...file.bytes],
  );
  for (const item of text) {
    expect(item.text).toContain('Approved');
    expect(item.point[0]).toBeCloseTo(item.expected[0], 1);
    expect(item.point[1]).toBeCloseTo(item.expected[1], 1);
  }
  await page.locator('#exported-pdf').screenshot({ path: 'test-results/signed-export.png' });
});
test('signature cleanup, file privacy, and narrow PDF workspaces', async ({ page }) => {
  const external: string[] = [],
    uploads: string[] = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith('http://127.0.0.1:5173'))
      external.push(request.url());
    if (request.method() !== 'GET') uploads.push(request.url());
  });
  await page.goto('/tools/photo-signature');
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 600, 200);
    ctx.strokeStyle = '#202328';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(80, 140);
    ctx.lineTo(180, 50);
    ctx.lineTo(300, 150);
    ctx.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.locator('input[type=file]').setInputFiles({
    name: 'signature.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await page.getByRole('button', { name: 'Signature', exact: true }).click();
  await result(page, 'Prepare image');
  const file = await download(page);
  const alpha = await page.evaluate(
    async (data) => {
      const image = await createImageBitmap(new Blob([new Uint8Array(data)]));
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
      return {
        transparent: pixels[3] === 0,
        ink: pixels.some((value, index) => index % 4 === 3 && value === 255),
      };
    },
    [...file.bytes],
  );
  expect(alpha).toEqual({ transparent: true, ink: true });
  expect(uploads).toEqual([]);
  expect(external).toEqual([]);
  await page.setViewportSize({ width: 320, height: 740 });
  for (const slug of [
    'merge-pdf',
    'split-pdf',
    'organize-pdf',
    'sign-pdf',
    'docx-to-markdown',
    'markdown-to-pdf',
  ]) {
    await page.goto(`/tools/${slug}`);
    if (slug !== 'markdown-to-pdf') {
      await page.getByRole('button', { name: 'Try sample' }).click();
      await expect(page.locator('.export-button')).toBeVisible();
    }
    if (['merge-pdf', 'split-pdf', 'organize-pdf'].includes(slug))
      await expect(page.locator('.page-tile').first()).toBeVisible();
    if (slug === 'markdown-to-pdf') await expect(page.getByLabel('Markdown editor')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const overflowing = await page
      .locator('.page-actions')
      .evaluateAll((rows) => rows.some((row) => row.scrollWidth > row.clientWidth + 1));
    expect(overflowing).toBe(false);
  }
  await page.screenshot({ path: 'test-results/narrow-markdown.png', fullPage: true });
});
test('DOCX retains heading, table, and image files in Markdown bundle', async ({ page }) => {
  await upload(page, 'docx-to-markdown', ['project-notes.docx']);
  await result(page, 'Convert document');
  const md = await download(page);
  expect(md.name).toMatch(/\.md$/);
  expect(md.bytes.toString()).toContain('# A little room to think');
  expect(md.bytes.toString()).toContain('| Task | Status |');
  expect(md.bytes.toString()).toContain('images/image-1.jpg');
  const zip = await JSZip.loadAsync((await download(page, 1)).bytes);
  expect(zip.file('images/image-1.jpg')).not.toBeNull();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(page.locator('.markdown-preview img')).toBeVisible();
});
test('Markdown PDF contains selectable text and preview blocks unsafe/external markup', async ({
  page,
}) => {
  await page.goto('/tools/markdown-to-pdf');
  await result(page, 'Export PDF');
  const file = await download(page);
  expect((await PDFDocument.load(file.bytes)).getPageCount()).toBeGreaterThan(0);
  const text = await page.evaluate(
    async (data) => {
      // @ts-expect-error Browser import from the dev server.
      const { getDocument } = await import('/src/lib/pdf-render.ts');
      const pdf = await getDocument(new Uint8Array(data));
      const result = (await (await pdf.getPage(1)).getTextContent()).items
        .map((item: { str?: string }) => item.str || '')
        .join(' ');
      await pdf.loadingTask.destroy();
      return result;
    },
    [...file.bytes],
  );
  expect(text).toContain('Project notes');
  expect(text).toContain('Prepare files');
  await page
    .getByLabel('Markdown editor')
    .fill(
      '<script>alert(1)</script>\n<img src="https://invalid.example/track" onerror="alert(2)">\n[Bad](javascript:alert(3))',
    );
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await expect(
    page.locator(
      '.markdown-preview script,.markdown-preview img,.markdown-preview [href^="javascript:"]',
    ),
  ).toHaveCount(0);
});
test('samples, search, error recovery, and responsive layouts', async ({ page }) => {
  await page.goto('/tools/compress-image/');
  await expect(page).toHaveTitle('Image compressor | Filework');
  await page.goto('/');
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Try sample' }).click();
  await result(page, 'Compress images');
  await page.getByRole('button', { name: 'Clear files' }).click();
  await expect(page.getByRole('button', { name: 'Try sample' })).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({
    name: 'broken.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toContainText('damaged');
  await page.getByRole('button', { name: 'Clear files' }).click();
  await page.getByRole('button', { name: 'Find a tool' }).click();
  await page.getByRole('textbox', { name: 'Search tools' }).fill('split');
  await page
    .getByRole('dialog')
    .getByRole('link', { name: /Split PDF/ })
    .click();
  await expect(page).toHaveURL(/split-pdf/);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tools/compress-image');
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page
    .getByRole('navigation', { name: 'Tools' })
    .getByRole('link', { name: 'Resize & crop', exact: true })
    .click();
  await page.getByRole('button', { name: 'Try sample' }).click();
  await expect(page.getByRole('button', { name: 'Export images' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/mobile-editor.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/tools/sign-pdf');
  await page.getByRole('button', { name: 'Try sample' }).click();
  await expect(page.getByRole('button', { name: 'Add text', exact: true })).toBeEnabled();
  await page.screenshot({ path: 'test-results/mobile-sign.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
