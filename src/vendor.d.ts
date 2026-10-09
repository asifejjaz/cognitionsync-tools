declare module 'turndown-plugin-gfm' {
  import TurndownService from 'turndown';
  export const gfm: TurndownService.Plugin;
}
declare module 'heic-to' {
  export function heicTo(options: { blob: Blob; type: string; quality?: number }): Promise<Blob>;
}
declare module 'mammoth/mammoth.browser' {
  import mammoth from 'mammoth';
  export default mammoth;
}
