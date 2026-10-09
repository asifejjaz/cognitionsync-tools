import { readFile, writeFile, mkdir } from 'node:fs/promises';
import ts from 'typescript';

const compiled = ts.transpileModule(await readFile('src/catalog.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText;
const { tools } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);
const template = await readFile('dist/index.html', 'utf8');
const escape = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const pages = tools.map((tool) => ({
  path: `/tools/${tool.id}`,
  title: tool.title,
  description: tool.description,
}));
pages.push(
  {
    path: '/all-tools',
    title: 'All tools',
    description: 'Image, PDF, and document tools from Filework.',
  },
  {
    path: '/privacy',
    title: 'File privacy',
    description: 'How Filework processes files locally in your browser.',
  },
  { path: '/about', title: 'About Filework', description: 'An independent file utility project.' },
  { path: '/roadmap', title: 'Release roadmap', description: 'The Filework release roadmap.' },
);
const site = process.env.SITE_URL ? new URL(process.env.SITE_URL).origin : undefined;
for (const page of pages) {
  let html = template
    .replace(/<title>.*?<\/title>/, `<title>${escape(page.title)} | Filework</title>`)
    .replace(
      /<meta name="description" content="[^"]*"\s*\/?\s*>/,
      `<meta name="description" content="${escape(page.description)}" />`,
    );
  if (site)
    html = html.replace('</head>', `<link rel="canonical" href="${site}${page.path}" /></head>`);
  html = html.replace(
    '<div id="root"></div>',
    `<div id="root"><main><h1>${escape(page.title)}</h1><p>${escape(page.description)}</p><nav>${tools.map((tool) => `<a href="/tools/${tool.id}">${escape(tool.title)}</a>`).join(' | ')}</nav><p>JavaScript is required to process files on your device.</p></main></div>`,
  );
  await mkdir(`dist${page.path}`, { recursive: true });
  await writeFile(`dist${page.path}/index.html`, html);
}
await writeFile(
  'dist/robots.txt',
  `User-agent: *\nAllow: /\n${site ? `Sitemap: ${site}/sitemap.xml\n` : ''}`,
);
await writeFile(
  'dist/404.html',
  template.replace(/<title>.*?<\/title>/, '<title>Not found | Filework</title>'),
);
if (site)
  await writeFile(
    'dist/sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((page) => `<url><loc>${site}${page.path}</loc></url>`).join('')}</urlset>`,
  );
console.log(
  `Built ${pages.length} route documents${site ? ` for ${site}` : ' (set SITE_URL to generate canonical URLs and sitemap)'}.`,
);
