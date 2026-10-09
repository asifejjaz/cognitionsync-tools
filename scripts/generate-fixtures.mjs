import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import JSZip from 'jszip';

const directory = new URL('../public/samples/', import.meta.url);
await mkdir(directory, { recursive: true });
const pdf = await PDFDocument.create();
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
for (let index = 0; index < 3; index++) {
  const page = pdf.addPage([595.28, 841.89]);
  page.drawText('FILEWORK / PROJECT NOTES', {
    x: 48,
    y: 780,
    size: 10,
    font: bold,
    color: rgb(0.2, 0.4, 0.35),
  });
  page.drawText(['A little room to think', 'The plan, on paper', 'Ready for review'][index], {
    x: 48,
    y: 720,
    size: 27,
    font: bold,
  });
  page.drawText(`Sample page ${index + 1}`, { x: 48, y: 682, size: 13, font: regular });
  page.drawText('A good document starts with a clear idea.', {
    x: 48,
    y: 630,
    size: 12,
    font: regular,
  });
  page.drawText('Keep the first release focused. Review every export.', {
    x: 48,
    y: 601,
    size: 12,
    font: regular,
  });
  page.drawLine({
    start: { x: 48, y: 220 },
    end: { x: 320, y: 220 },
    thickness: 0.8,
    color: rgb(0.7, 0.7, 0.7),
  });
  page.drawText('Signature / approval', { x: 48, y: 201, size: 10, font: regular });
  page.drawText(`${index + 1} / 3`, { x: 500, y: 36, size: 9, font: regular });
}
await writeFile(new URL('project-notes.pdf', directory), await pdf.save());
const rotated = await PDFDocument.load(await pdf.save());
rotated.getPage(0).setRotation(degrees(90));
rotated.getPage(1).setCropBox(25, 30, 500, 740);
await writeFile(new URL('rotated-cropped.pdf', directory), await rotated.save());
await writeFile(
  new URL('project-notes.md', directory),
  '# A little room to think\n\nA good document starts with a clear idea.\n\n## Project notes\n\n- Prepare files\n- Review the document\n\n| Task | Status |\n| --- | --- |\n| Prepare files | Complete |\n| Review document | In progress |\n\n> Keep the first release focused.\n\n```javascript\nconst nextStep = "Make something useful";\n```\n',
);
const zip = new JSZip();
zip.file(
  '[Content_Types].xml',
  '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
);
zip.file(
  '_rels/.rels',
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
);
zip.file(
  'word/styles.xml',
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/></w:style></w:styles>',
);
zip.file(
  'word/_rels/document.xml.rels',
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/woodland.jpg"/></Relationships>',
);
const paragraph = (text, style = '') =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
const cell = (text) => `<w:tc>${paragraph(text)}</w:tc>`;
zip.file(
  'word/document.xml',
  `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${paragraph('A little room to think', 'Heading1')}${paragraph('A good document starts with a clear idea.')}<w:tbl><w:tr>${cell('Task')}${cell('Status')}</w:tr><w:tr>${cell('Prepare files')}${cell('Complete')}</w:tr></w:tbl><w:p><w:r><w:drawing><wp:inline><wp:extent cx="4572000" cy="3048000"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:blipFill><a:blip r:embed="rId2"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p><w:sectPr/></w:body></w:document>`,
);
zip.file('word/media/woodland.jpg', await readFile(new URL('woodland.jpg', directory)));
await writeFile(
  new URL('project-notes.docx', directory),
  await zip.generateAsync({ type: 'nodebuffer' }),
);
console.log(
  'Generated three-page PDF, rotated/cropped PDF, Markdown, and DOCX with table and image.',
);
