import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { tools } from '../../src/catalog';

test('production routes, methods, caching and worker MIME are correct', async ({ request }) => {
  test.skip(!process.env.FILEWORK_PRODUCTION_URL, 'Set FILEWORK_PRODUCTION_URL.');
  const site = process.env.FILEWORK_PRODUCTION_URL!;
  for (const tool of tools) {
    const response = await request.get(`${site}/tools/${tool.id}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(await response.text()).toContain(`href="${site}/tools/${tool.id}"`);
  }
  expect((await request.post(`${site}/`)).status()).toBe(405);
  expect((await request.get(`${site}/unknown-not-a-tool`)).status()).toBe(404);
  const sitemap = await request.get(`${site}/sitemap.xml`);
  expect(sitemap.status()).toBe(200);
  for (const tool of tools) expect(await sitemap.text()).toContain(`/tools/${tool.id}`);
  expect((await request.get(`${site}/THIRD-PARTY-NOTICES.txt`)).status()).toBe(200);
  const html = await readFile('dist/index.html', 'utf8');
  const asset = html.match(/src="(\/assets\/[^"]+\.js)"/)![1];
  const javascript = await request.get(`${site}${asset}`, {
    headers: { 'Accept-Encoding': 'gzip' },
  });
  expect(javascript.status()).toBe(200);
  expect(javascript.headers()['cache-control']).toContain('max-age=31536000');
  expect(javascript.headers()['content-encoding']).toBe('gzip');
  const { readdir } = await import('node:fs/promises');
  const worker = (await readdir('dist/assets')).find((file) => file.endsWith('.mjs'))!;
  const response = await request.head(`${site}/assets/${worker}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/javascript');
});

test('built application processes files under production CSP', async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(
    !process.env.FILEWORK_PRODUCTION_URL,
    'Run with FILEWORK_PRODUCTION_URL after pnpm build and pnpm preview.',
  );
  const errors: string[] = [];
  const nonGetRequests: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) nonGetRequests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /content security|violates.*directive|refused to/i.test(message.text())
    )
      errors.push(message.text());
  });
  for (const item of [
    { slug: 'compress-image', fixture: 'woodland.jpg', action: 'Compress images' },
    { slug: 'heic-to-jpg', fixture: 'example.heic', action: 'Convert images' },
    { slug: 'merge-pdf', fixture: 'project-notes.pdf', action: 'Merge PDFs' },
    { slug: 'sign-pdf', fixture: 'project-notes.pdf', action: 'Save signed PDF' },
    { slug: 'docx-to-markdown', fixture: 'project-notes.docx', action: 'Convert document' },
    { slug: 'markdown-to-pdf', fixture: 'project-notes.md', action: 'Export PDF' },
  ]) {
    const response = await page.goto(`${process.env.FILEWORK_PRODUCTION_URL}/tools/${item.slug}`);
    expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
    await page
      .locator('input[type=file]')
      .first()
      .setInputFiles(path.resolve('public/samples', item.fixture));
    if (item.slug === 'sign-pdf')
      await page.getByRole('button', { name: 'Add text', exact: true }).click();
    await page.getByRole('button', { name: item.action, exact: true }).click();
    await expect(page.getByRole('region', { name: 'Results' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    const pending = page.waitForEvent('download');
    await page.locator('.result-row button').first().click();
    const output = await pending,
      bytes = await readFile((await output.path())!);
    expect(bytes.length).toBeGreaterThan(100);
    if (output.suggestedFilename().endsWith('.pdf'))
      expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
    if (item.slug === 'heic-to-jpg') expect(bytes.subarray(0, 2).toString('hex')).toBe('ffd8');
  }
  expect(errors).toEqual([]);
  expect(nonGetRequests).toEqual([]);
});
