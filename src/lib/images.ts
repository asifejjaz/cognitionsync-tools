import type { ImageInfo, OutputFile } from '../types';
import { basename } from './files';

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface ImageSettings {
  format: 'jpeg' | 'png' | 'webp';
  quality: number;
  targetKB?: number;
  width?: number;
  height?: number;
  crop?: CropArea;
  cleanSignature?: boolean;
  preserveAspect?: boolean;
}
const MAX_PIXELS = 24_000_000;
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export async function loadImage(file: Blob, name = ''): Promise<ImageInfo> {
  let blob = file;
  if (/\.hei[cf]$/i.test(name) || /image\/hei[cf]/i.test(file.type)) {
    const { heicTo } = await import('heic-to/csp');
    blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.95 });
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = await imageElement(url);
    if (img.naturalWidth * img.naturalHeight > MAX_PIXELS)
      throw new Error('This image exceeds 24 megapixels. Use a smaller image.');
    return { blob, url, width: img.naturalWidth, height: img.naturalHeight };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
export function imageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('This image is damaged or its format is not supported.'));
    image.src = url;
  });
}
export function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('The browser could not encode this image.'));
        if (blob.type !== `image/${format}`)
          return reject(
            new Error(`This browser cannot export ${format.toUpperCase()}. Choose JPG or PNG.`),
          );
        resolve(blob);
      },
      `image/${format}`,
      quality,
    ),
  );
}
export async function transformImage(file: File, settings: ImageSettings): Promise<OutputFile> {
  const info = await loadImage(file, file.name);
  try {
    const image = await imageElement(info.url);
    const crop = settings.crop || { x: 0, y: 0, width: info.width, height: info.height };
    const requestedWidth = Math.round(settings.width ?? crop.width);
    const requestedHeight = Math.round(
      settings.preserveAspect
        ? (requestedWidth * crop.height) / crop.width
        : (settings.height ?? crop.height),
    );
    let width = requestedWidth,
      height = requestedHeight;
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 1 ||
      height < 1 ||
      width * height > MAX_PIXELS ||
      width > 12000 ||
      height > 12000
    )
      throw new Error('Choose dimensions from 1 to 12,000 pixels, up to 24 megapixels.');
    if (
      settings.targetKB !== undefined &&
      (!Number.isFinite(settings.targetKB) || settings.targetKB < 1)
    )
      throw new Error('Enter a file-size limit of at least 1 KB.');
    const canvas = document.createElement('canvas');
    function draw() {
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: !!settings.cleanSignature })!;
      if (settings.format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      }
      ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
      if (settings.cleanSignature) {
        const pixels = ctx.getImageData(0, 0, width, height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const lightness = (pixels.data[i] + pixels.data[i + 1] + pixels.data[i + 2]) / 3;
          if (lightness > 205) {
            if (settings.format === 'jpeg')
              pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
            else pixels.data[i + 3] = 0;
          }
        }
        ctx.putImageData(pixels, 0, 0);
      }
    }
    draw();
    let result = await encodeCanvas(canvas, settings.format, settings.quality);
    const budget =
      settings.targetKB === undefined ? undefined : Math.floor(settings.targetKB * 1024);
    if (budget && result.size > budget) {
      let found: Blob | undefined;
      for (let resize = 0; resize < 28; resize++) {
        await nextFrame();
        if (settings.format !== 'png') {
          let low = 0.04,
            high = settings.quality;
          const lowest = await encodeCanvas(canvas, settings.format, low);
          if (lowest.size <= budget) {
            found = lowest;
            for (let step = 0; step < 8; step++) {
              const quality = (low + high) / 2;
              const candidate = await encodeCanvas(canvas, settings.format, quality);
              if (candidate.size <= budget) {
                low = quality;
                found = candidate;
              } else high = quality;
            }
            break;
          }
        } else if (result.size <= budget) {
          found = result;
          break;
        }
        if (width <= 16 || height <= 16) break;
        width = Math.max(1, Math.floor(width * 0.82));
        height = Math.max(1, Math.floor(height * 0.82));
        draw();
        result = await encodeCanvas(canvas, settings.format, settings.quality);
        if (result.size <= budget) {
          found = result;
          break;
        }
      }
      if (!found)
        throw new Error(
          'This file cannot fit the requested limit. Increase the limit or choose JPG/WebP.',
        );
      result = found;
    }
    const extension = settings.format === 'jpeg' ? 'jpg' : settings.format;
    return {
      name: `${basename(file.name)}-filework.${extension}`,
      blob: result,
      width,
      height,
      sourceBytes: file.size,
      note:
        width !== requestedWidth || height !== requestedHeight
          ? 'Dimensions reduced to meet the file-size limit.'
          : undefined,
    };
  } finally {
    URL.revokeObjectURL(info.url);
  }
}
