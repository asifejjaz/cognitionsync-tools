# Reuse Research: October 9, 2026

Status: upstream documentation/license inspection, not completed integration testing. No GitHub forks have been created. The first release already reuses PDF.js, pdf-lib, Mammoth, Turndown, pdfmake and heic-to instead of inventing file parsers. Keep one owner-controlled website and import selected engines rather than launching unrelated, duplicated UIs.

| Project | Useful additions | Execution | Current license / decision |
| --- | --- | --- | --- |
| [Squoosh](https://github.com/GoogleChromeLabs/squoosh) | Better JPEG/WebP/AVIF optimization and visual comparison | Browser | Apache-2.0; first evaluation candidate. Review codec-specific notices. Remove upstream analytics unless explicitly approved. |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | Image OCR, scanned-document text extraction | Browser worker | Apache-2.0. PDFs need page rendering first; test PDF.js-to-OCR pipeline. Budget language/model downloads and mobile RAM. |
| [pdfme](https://github.com/pdfme/pdfme) | PDF templates, forms, invoices and certificate builders | Browser / Node | [MIT](https://github.com/pdfme/pdfme/blob/main/LICENSE.md). Good React/TypeScript fit. Evaluate a template builder separately from true cryptographic PDF signing. |
| [BentoPDF](https://github.com/alam00000/bentopdf) | More PDF conversions and organizational tools | Primarily browser | AGPL-3.0 or commercial; not permissive MIT. Default external processing libraries have separate copyleft obligations. Use as a benchmark/reference until licensing is deliberately chosen. |
| [IT-Tools](https://github.com/CorentinTh/it-tools) | JSON, encoding, hashing, formatting, developer utilities | Browser, Vue | GPL-3.0, not MIT. Evaluate separately; do not copy code into an unlicensed/proprietary app without resolving obligations. |
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | Audio conversion, trimming, lightweight video processing | Browser | Wrapper MIT; [core/codecs retain FFmpeg and dependency licenses](https://ffmpegwasm.netlify.app/docs/faq/). Build-dependent LGPL/GPL. Heavy browser memory/CPU, larger downloads. Later evaluation. |
| [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | Office/PDF conversions, OCR and advanced processing | Server / mixed | [Root MIT license explicitly excludes multiple directories with their own licenses](https://github.com/Stirling-Tools/Stirling-PDF/blob/main/LICENSE). Inspect each selected component, not just the repository badge. Requires isolated workers, a bounded queue, timeouts, quotas and deletion policies for server conversions. |

## Evaluation Order

1. Squoosh codecs: compare the existing KB-target compressor on a fixed image corpus for output bytes, dimensions, perceptual quality, download size and mobile memory. Do not regress the target-KB guarantee.
2. Tesseract.js: clean/rotated/noisy English and Urdu images, PDF page rendering, accuracy and cancellation. Lazy-load models and cache them explicitly. Avoid putting documents or extracted text in analytics.
3. pdfme: one editable invoice template, Unicode fonts, multipage layout, downloaded PDF structure and accessibility. Keep template data local.
4. Developer utilities: choose compatible upstream libraries or write small original transformations with known standards and focused tests. Resolve IT-Tools licensing before any source reuse.
5. Advanced PDF/media: evaluate copyleft/commercial choices and separate worker services only after traffic demand justifies them.

Before importing: pin a commit/version, preserve notices, check advisories and maintenance, inspect install hooks, test malformed files, test offline processing under our CSP, review external network requests, and measure lazy-loaded bundle sizes. Popularity and GitHub stars do not prove traffic demand or security. Forking a repository does not waive its license, trademark or dependency obligations.
