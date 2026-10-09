import { marked, type Token, type Tokens } from 'marked';
import DOMPurify from 'dompurify';
import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { OutputFile } from '../types';
import { basename } from './files';

export const sampleMarkdown = `# A little room to think\n\nA good document starts with a clear idea.\n\n## Project notes\n\n- Keep the first release focused.\n- Make every export worth keeping.\n- Leave time to review the details.\n\n| Task | Status |\n| --- | --- |\n| Prepare files | Complete |\n| Review document | In progress |\n\n> The useful part is the part you can use.\n\n\`\`\`javascript\nconst nextStep = "Make something useful";\nconsole.log(nextStep);\n\`\`\`\n`;
export function safeMarkdownHtml(markdown: string) {
  return DOMPurify.sanitize(marked.parse(markdown, { async: false }), {
    FORBID_TAGS: ['img', 'iframe', 'style', 'input', 'form'],
    FORBID_ATTR: ['style'],
  });
}
export async function docxToMarkdown(
  file: File,
): Promise<{ markdown: string; html: string; outputs: OutputFile[]; warnings: string[] }> {
  const [{ default: mammoth }, { default: TurndownService }, { gfm }, { default: JSZip }] =
    await Promise.all([
      import('mammoth/mammoth.browser'),
      import('turndown'),
      import('turndown-plugin-gfm'),
      import('jszip'),
    ]);
  const bytes = await file.arrayBuffer();
  const archive = await JSZip.loadAsync(bytes);
  let declaredSize = 0;
  for (const entry of Object.values(archive.files)) {
    const size =
      (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0;
    declaredSize += size;
  }
  if (declaredSize > 80 * 1024 * 1024)
    throw new Error('This document expands beyond 80 MB. Use a smaller DOCX.');
  const assets = new Map<string, string>();
  const zip = new JSZip();
  let imageCount = 0;
  const converted = await mammoth.convertToHtml(
    { arrayBuffer: bytes },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const extension = image.contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
        const name = `images/image-${++imageCount}.${extension.replace(/[^a-z0-9]/gi, '')}`;
        const base64 = await image.read('base64');
        zip.file(name, base64, { base64: true });
        assets.set(name, `data:${image.contentType};base64,${base64}`);
        return { src: name };
      }),
    },
  );
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });
  service.use(gfm);
  service.addRule('wordTableCells', {
    filter: ['th', 'td'],
    replacement: (content, node) =>
      `${node.previousSibling ? ' ' : '| '}${content.trim().replace(/\n+/g, '<br>').replace(/\|/g, '\\|')} |`,
  });
  service.addRule('mergedCellTables', {
    filter: (node) =>
      node.nodeName === 'TABLE' &&
      !!(node as HTMLElement).querySelector(
        '[colspan]:not([colspan="1"]),[rowspan]:not([rowspan="1"])',
      ),
    replacement: (_, node) => `\n\n${(node as HTMLElement).outerHTML}\n\n`,
  });
  const preview = DOMPurify.sanitize(converted.value, { RETURN_DOM: true }) as HTMLElement;
  // GFM tables require a header; Word often marks every cell as ordinary data.
  preview.querySelectorAll('table').forEach((table) => {
    if (table.querySelector('[colspan]:not([colspan="1"]),[rowspan]:not([rowspan="1"])')) return;
    table
      .querySelector('tr')
      ?.querySelectorAll('td')
      .forEach((cell) => {
        const header = preview.ownerDocument.createElement('th');
        header.append(...Array.from(cell.childNodes));
        cell.replaceWith(header);
      });
  });
  const markdown = service.turndown(preview);
  const name = basename(file.name);
  zip.file(`${name}.md`, markdown);
  const markdownBlob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const outputs: OutputFile[] = [{ name: `${name}.md`, blob: markdownBlob }];
  if (assets.size)
    outputs.push({
      name: `${name}-with-images.zip`,
      blob: await zip.generateAsync({ type: 'blob' }),
    });
  preview.querySelectorAll('img').forEach((image) => {
    const src = assets.get(image.getAttribute('src') || '');
    if (src) image.src = src;
    else image.remove();
  });
  const warnings = converted.messages.map((message) => message.message);
  warnings.unshift(
    'Page layout, headers, footers, text boxes, comments, and tracked changes need review after conversion.',
  );
  if (preview.querySelector('table'))
    warnings.push(
      'Simple tables use the first row as a Markdown header. Merged-cell tables remain HTML.',
    );
  return { markdown, html: DOMPurify.sanitize(preview.innerHTML), outputs, warnings };
}

function richText(tokens: Token[] = []): ContentText[] {
  return tokens.flatMap((token) => {
    if (token.type === 'strong' || token.type === 'em' || token.type === 'del') {
      const nested = richText((token as Tokens.Strong).tokens);
      return nested.map((span) => ({
        ...span,
        bold: token.type === 'strong' || span.bold,
        italics: token.type === 'em' || span.italics,
        decoration: token.type === 'del' ? 'lineThrough' : span.decoration,
      }));
    }
    if (token.type === 'link') {
      const link = token as Tokens.Link;
      const href = /^(https?:|mailto:)/i.test(link.href) ? link.href : undefined;
      return richText(link.tokens).map((span) => ({
        ...span,
        link: href,
        color: href ? '#275bbc' : undefined,
      }));
    }
    if (token.type === 'codespan')
      return [{ text: (token as Tokens.Codespan).text, background: '#f0f2f5', fontSize: 9 }];
    if (token.type === 'br') return [{ text: '\n' }];
    if (token.type === 'image')
      return [
        { text: `[Image: ${(token as Tokens.Image).text || 'not embedded'}]`, italics: true },
      ];
    if (token.type === 'escape' || token.type === 'text') {
      const text = token as Tokens.Text;
      return text.tokens ? richText(text.tokens) : [{ text: text.text }];
    }
    return [{ text: 'text' in token ? String(token.text) : '' }];
  });
}
function blocks(tokens: Token[]): Content[] {
  const output: Content[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading;
        output.push({
          text: richText(heading.tokens),
          fontSize: [0, 24, 18, 14, 12, 11, 10][heading.depth],
          bold: true,
          margin: [0, 12, 0, 8],
        });
        break;
      }
      case 'paragraph':
      case 'text': {
        const text = token as Tokens.Paragraph;
        output.push({
          text: text.tokens ? richText(text.tokens) : text.text,
          margin: [0, 0, 0, 9],
          lineHeight: 1.3,
        });
        break;
      }
      case 'blockquote':
        output.push({
          stack: blocks((token as Tokens.Blockquote).tokens),
          margin: [14, 5, 0, 8],
          color: '#666666',
          italics: true,
        });
        break;
      case 'code':
        output.push({
          text: (token as Tokens.Code).text,
          fontSize: 9,
          background: '#f2f4f6',
          preserveLeadingSpaces: true,
          margin: [0, 5, 0, 12],
        });
        break;
      case 'list': {
        const list = token as Tokens.List;
        const items = list.items.map((item) => ({ stack: blocks(item.tokens) }));
        output.push(
          list.ordered
            ? {
                ol: items,
                start: typeof list.start === 'number' ? list.start : 1,
                margin: [0, 0, 0, 8],
              }
            : { ul: items, margin: [0, 0, 0, 8] },
        );
        break;
      }
      case 'table': {
        const table = token as Tokens.Table;
        const header = table.header.map((cell) => ({
          text: richText(cell.tokens),
          bold: true,
          fillColor: '#f0f2f5',
          margin: [4, 5, 4, 5] as [number, number, number, number],
        }));
        const rows = table.rows.map((row) =>
          row.map((cell, i) => ({
            text: richText(cell.tokens),
            alignment: table.align[i] || 'left',
            margin: [4, 5, 4, 5] as [number, number, number, number],
          })),
        );
        output.push({
          table: {
            headerRows: 1,
            widths: Array(table.header.length).fill('*'),
            body: [header, ...rows],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 5, 0, 12],
        });
        break;
      }
      case 'hr':
        output.push({
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 480, y2: 0, lineColor: '#dddddd' }],
          margin: [0, 10, 0, 10],
        });
        break;
      case 'html':
        output.push({
          text: DOMPurify.sanitize((token as Tokens.HTML).text, { ALLOWED_TAGS: [] }),
          margin: [0, 0, 0, 8],
        });
        break;
    }
  }
  return output;
}
export async function markdownToPdf(
  markdown: string,
  title: string,
  paper: 'A4' | 'LETTER',
  fontSize: number,
): Promise<OutputFile> {
  if (!markdown.trim()) throw new Error('Add some Markdown before exporting.');
  if (markdown.length > 500_000) throw new Error('The Markdown limit is 500,000 characters.');
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  pdfMake.vfs = fonts;
  const content = blocks(marked.lexer(markdown));
  const definition: TDocumentDefinitions = {
    pageSize: paper,
    pageMargins: [48, 44, 48, 44],
    info: { title: title || 'Document', author: 'Filework' },
    defaultStyle: { font: 'Roboto', fontSize },
    content,
    footer: (current, total) => ({
      text: `${current} / ${total}`,
      alignment: 'center',
      fontSize: 8,
      color: '#777777',
      margin: [0, 14, 0, 0],
    }),
  };
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      pdfMake.createPdf(definition).getBlob(resolve);
    } catch (error) {
      reject(error);
    }
  });
  return {
    name: `${basename(title || 'document')}.pdf`,
    blob,
    note: /!\[/.test(markdown)
      ? 'Image references are exported as captions. Add images to the source PDF separately.'
      : undefined,
  };
}
