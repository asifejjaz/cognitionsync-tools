import type { OutputFile } from '../types';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
export const MAX_FILES = 30;
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
export function basename(name: string) {
  return name.replace(/\.[^.]+$/, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') || 'file';
}
export function validateFiles(files: File[], accept: string) {
  if (files.length > MAX_FILES) throw new Error(`Choose up to ${MAX_FILES} files at a time.`);
  if (files.reduce((n, file) => n + file.size, 0) > MAX_TOTAL_BYTES)
    throw new Error('This batch exceeds 100 MB. Process a smaller batch.');
  const extensions = accept.split(',');
  for (const file of files) {
    if (file.size === 0) throw new Error(`${file.name} is empty.`);
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} exceeds the 25 MB file limit.`);
    if (!extensions.some((ext) => file.name.toLowerCase().endsWith(ext)))
      throw new Error(`${file.name} is not a supported file type.`);
  }
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export async function downloadOutputs(outputs: OutputFile[]) {
  if (outputs.length === 1) return downloadBlob(outputs[0].blob, outputs[0].name);
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const names = new Set<string>();
  for (const output of outputs) {
    let name = output.name,
      n = 2;
    while (names.has(name))
      name = `${basename(output.name)}-${n++}.${output.name.split('.').pop()}`;
    names.add(name);
    zip.file(name, output.blob);
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), 'filework-results.zip');
}
export const errorMessage = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'The file could not be processed. Please try another file.';
