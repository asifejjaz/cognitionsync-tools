import { useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import {
  ArrowLeft,
  ArrowRight,
  Image as ImageIcon,
  LockKeyhole,
  UnlockKeyhole,
  RotateCcw,
} from 'lucide-react';
import type { ImageInfo, OutputFile, Tool } from '../types';
import { loadImage, transformImage, type CropArea } from '../lib/images';
import { errorMessage, formatBytes } from '../lib/files';
import { Field, Segmented } from './Controls';

export default function ImageTools({
  tool,
  files,
  busy,
  onRun,
  onError,
}: {
  tool: Tool;
  files: File[];
  busy: boolean;
  onRun: (job: () => Promise<OutputFile[]>) => void;
  onError: (error: string) => void;
}) {
  const [active, setActive] = useState(0);
  const [image, setImage] = useState<ImageInfo>();
  const [format, setFormat] = useState<'jpeg' | 'png' | 'webp'>('jpeg');
  const [targetKB, setTargetKB] = useState(100);
  const [quality, setQuality] = useState(90);
  const [width, setWidth] = useState(tool.id === 'photo-signature' ? 600 : 1200),
    [height, setHeight] = useState(800);
  const [locked, setLocked] = useState(true);
  const [mode, setMode] = useState<'resize' | 'crop'>('resize');
  const [profile, setProfile] = useState<'photo' | 'signature'>('photo');
  const [clean, setClean] = useState(true);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState('original');
  const area = useRef<CropArea | undefined>(undefined);
  const file = files[Math.min(active, files.length - 1)];
  useEffect(() => {
    setActive((current) => Math.min(current, files.length - 1));
  }, [files.length]);
  useEffect(() => {
    let cancelled = false,
      loaded: ImageInfo | undefined;
    setImage(undefined);
    area.current = undefined;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    loadImage(file, file.name)
      .then((info) => {
        loaded = info;
        if (!cancelled) {
          setImage(info);
          if (tool.id !== 'photo-signature') {
            setWidth(info.width);
            setHeight(info.height);
          }
        } else URL.revokeObjectURL(info.url);
      })
      .catch((error) => {
        if (!cancelled) onError(errorMessage(error));
      });
    return () => {
      cancelled = true;
      if (loaded) URL.revokeObjectURL(loaded.url);
    };
  }, [file, tool.id]);
  const canCrop = tool.id === 'resize-image' || tool.id === 'photo-signature';
  const cropping = canCrop && (mode === 'crop' || tool.id === 'photo-signature');
  const compression = tool.id === 'compress-image' || tool.id === 'photo-signature';
  const cropAspect =
    tool.id === 'photo-signature'
      ? width > 0 && height > 0 && Number.isFinite(width / height)
        ? width / height
        : 0.75
      : aspect === 'original'
        ? image
          ? image.width / image.height
          : 1.5
        : Number(aspect);
  function updateDimension(dimension: 'width' | 'height', value: number) {
    const ratio = cropping ? cropAspect : image ? image.width / image.height : 1;
    if (dimension === 'width') {
      setWidth(value);
      if (locked && tool.id !== 'photo-signature') setHeight(Math.round(value / ratio));
    } else {
      setHeight(value);
      if (locked && tool.id !== 'photo-signature') setWidth(Math.round(value * ratio));
    }
  }
  return (
    <div className="workbench">
      <div className="preview-column">
        <div className="panel-heading">
          <span>Preview</span>
          <span className="muted">
            {active + 1} / {files.length}
          </span>
        </div>
        <div className={`image-preview checkerboard ${cropping ? 'cropping' : ''}`}>
          {image ? (
            cropping ? (
              <Cropper
                image={image.url}
                crop={crop}
                zoom={zoom}
                aspect={cropAspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, pixels) => {
                  area.current = pixels;
                }}
              />
            ) : (
              <img src={image.url} alt={file.name} />
            )
          ) : (
            <div className="loading">
              <ImageIcon size={30} />
              <span>Opening image...</span>
            </div>
          )}
        </div>
        <div className="preview-caption">
          <div>
            <strong>{file.name}</strong>
            <span>
              {formatBytes(file.size)}
              {image ? ` / ${image.width} x ${image.height} px` : ''}
            </span>
          </div>
          <div className="navigation-controls">
            <button
              className="icon-button"
              title="Previous image"
              aria-label="Previous image"
              disabled={active === 0 || busy}
              onClick={() => setActive(active - 1)}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              className="icon-button"
              title="Next image"
              aria-label="Next image"
              disabled={active >= files.length - 1 || busy}
              onClick={() => setActive(active + 1)}
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
        {cropping && (
          <div className="crop-zoom">
            <Field label="Zoom">
              <input
                aria-label="Zoom"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
            </Field>
            <button
              className="icon-button"
              title="Reset crop"
              aria-label="Reset crop"
              onClick={() => {
                setCrop({ x: 0, y: 0 });
                setZoom(1);
              }}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        )}
      </div>
      <aside className="settings-panel" aria-label="Export settings">
        <div className="panel-heading">
          <span>Export settings</span>
        </div>
        <fieldset disabled={busy}>
          {tool.id === 'resize-image' && (
            <Segmented
              label="Operation"
              value={mode}
              options={[
                { value: 'resize', label: 'Resize' },
                { value: 'crop', label: 'Crop' },
              ]}
              onChange={setMode}
            />
          )}
          {tool.id === 'photo-signature' && (
            <Segmented
              label="Prepare"
              value={profile}
              options={[
                { value: 'photo', label: 'Photo' },
                { value: 'signature', label: 'Signature' },
              ]}
              onChange={(value) => {
                setProfile(value);
                setWidth(value === 'signature' ? 600 : 600);
                setHeight(value === 'signature' ? 200 : 800);
                setTargetKB(value === 'signature' ? 50 : 100);
                setFormat(value === 'signature' ? 'png' : 'jpeg');
              }}
            />
          )}
          {compression && (
            <>
              <Field label="Maximum file size">
                <div className="input-unit">
                  <input
                    aria-label="Maximum file size"
                    type="number"
                    min="1"
                    max="25000"
                    value={targetKB}
                    onChange={(event) => setTargetKB(Number(event.target.value))}
                  />
                  <span>KB</span>
                </div>
              </Field>
              <div className="size-presets">
                {[50, 100, 200, 500].map((size) => (
                  <button
                    type="button"
                    key={size}
                    className={targetKB === size ? 'active' : ''}
                    onClick={() => setTargetKB(size)}
                  >
                    {size} KB
                  </button>
                ))}
              </div>
            </>
          )}
          {(tool.id === 'resize-image' || tool.id === 'photo-signature') && (
            <>
              {mode === 'crop' && tool.id !== 'photo-signature' && (
                <Field label="Aspect ratio">
                  <select
                    aria-label="Aspect ratio"
                    value={aspect}
                    onChange={(event) => {
                      const value = event.target.value;
                      setAspect(value);
                      setHeight(
                        Math.round(
                          width /
                            (value === 'original'
                              ? image
                                ? image.width / image.height
                                : 1
                              : Number(value)),
                        ),
                      );
                    }}
                  >
                    <option value="original">Original</option>
                    <option value="1">Square (1:1)</option>
                    <option value="1.777777778">Landscape (16:9)</option>
                    <option value="0.75">Portrait (3:4)</option>
                  </select>
                </Field>
              )}
              <div className="dimensions">
                <Field label="Width">
                  <div className="input-unit">
                    <input
                      aria-label="Width"
                      type="number"
                      min="1"
                      max="12000"
                      value={width}
                      onChange={(event) => updateDimension('width', Number(event.target.value))}
                    />
                    <span>px</span>
                  </div>
                </Field>
                <button
                  className="icon-button aspect-lock"
                  title={locked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                  aria-label={locked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                  onClick={() => setLocked(!locked)}
                >
                  {locked ? <LockKeyhole size={16} /> : <UnlockKeyhole size={16} />}
                </button>
                <Field label="Height">
                  <div className="input-unit">
                    <input
                      aria-label="Height"
                      type="number"
                      min="1"
                      max="12000"
                      value={height}
                      onChange={(event) => updateDimension('height', Number(event.target.value))}
                    />
                    <span>px</span>
                  </div>
                </Field>
              </div>
            </>
          )}
          <Segmented
            label="Output format"
            value={format}
            options={[
              { value: 'jpeg', label: 'JPG' },
              { value: 'png', label: 'PNG' },
              ...(tool.id === 'heic-to-jpg' ? [] : [{ value: 'webp' as const, label: 'WebP' }]),
            ]}
            onChange={setFormat}
          />
          {format !== 'png' && (
            <Field label={`Quality / ${quality}%`}>
              <input
                aria-label="Quality"
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={(event) => setQuality(Number(event.target.value))}
              />
            </Field>
          )}
          {profile === 'signature' && tool.id === 'photo-signature' && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={clean}
                onChange={(event) => setClean(event.target.checked)}
              />
              Remove light background
            </label>
          )}
          {compression && (
            <p className="settings-note">
              Dimensions may shrink to meet the limit. The exported size is checked before download.
            </p>
          )}
          {cropping && files.length > 1 && (
            <p className="settings-note">Crop export uses the image currently selected.</p>
          )}
        </fieldset>
        <button
          className="primary export-button"
          disabled={busy || !image}
          onClick={() =>
            onRun(async () => {
              if (cropping && !area.current)
                throw new Error('Wait for the crop preview to finish opening.');
              const selected = cropping ? [file] : files;
              const results: OutputFile[] = [];
              for (const item of selected)
                results.push(
                  await transformImage(item, {
                    format,
                    quality: quality / 100,
                    targetKB: compression ? targetKB : undefined,
                    width: canCrop ? width : undefined,
                    height: canCrop ? height : undefined,
                    crop: cropping ? area.current : undefined,
                    preserveAspect: tool.id === 'resize-image' && locked && !cropping,
                    cleanSignature:
                      tool.id === 'photo-signature' && profile === 'signature' && clean,
                  }),
                );
              return results;
            })
          }
        >
          <ArrowRight size={17} />
          {busy ? 'Processing...' : tool.action}
        </button>
      </aside>
    </div>
  );
}
