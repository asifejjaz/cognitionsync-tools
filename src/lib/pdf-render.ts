import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export async function getDocument(bytes: Uint8Array) {
  const task = pdfjs.getDocument({ data: bytes.slice() });
  try {
    return await task.promise;
  } catch (error) {
    await task.destroy();
    throw error;
  }
}
