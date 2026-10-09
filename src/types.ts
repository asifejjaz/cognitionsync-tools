export type ToolId =
  | 'compress-image'
  | 'resize-image'
  | 'heic-to-jpg'
  | 'webp-converter'
  | 'photo-signature'
  | 'jpg-to-pdf'
  | 'merge-pdf'
  | 'split-pdf'
  | 'organize-pdf'
  | 'sign-pdf'
  | 'docx-to-markdown'
  | 'markdown-to-pdf';
export type ToolGroup = 'Images' | 'PDFs' | 'Documents';
export interface Tool {
  id: ToolId;
  title: string;
  nav: string;
  group: ToolGroup;
  accept: string;
  multiple: boolean;
  action: string;
  description: string;
}
export interface OutputFile {
  name: string;
  blob: Blob;
  width?: number;
  height?: number;
  sourceBytes?: number;
  note?: string;
}
export interface ImageInfo {
  blob: Blob;
  url: string;
  width: number;
  height: number;
}
export interface PageItem {
  id: string;
  fileIndex: number;
  pageIndex: number;
  rotation: number;
  excluded: boolean;
}
export interface PdfSource {
  name: string;
  bytes: Uint8Array;
  pages: number;
}
export interface Annotation {
  id: string;
  page: number;
  kind: 'text' | 'signature';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  dataUrl?: string;
  fontSize?: number;
  color?: string;
}
