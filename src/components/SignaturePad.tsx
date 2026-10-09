import { useEffect, useRef, useState } from 'react';
import { Eraser, Plus } from 'lucide-react';

export default function SignaturePad({
  onAdd,
  disabled,
}: {
  onAdd: (dataUrl: string) => void;
  disabled: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#202328';
  }, []);
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return [
      ((event.clientX - box.left) * 600) / box.width,
      ((event.clientY - box.top) * 220) / box.height,
    ];
  }
  return (
    <div className="signature-pad">
      <canvas
        ref={canvas}
        width="600"
        height="220"
        aria-label="Draw signature"
        onPointerDown={(event) => {
          if (disabled) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = true;
          const ctx = event.currentTarget.getContext('2d')!,
            [x, y] = point(event);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const [x, y] = point(event);
          const ctx = event.currentTarget.getContext('2d')!;
          ctx.lineTo(x, y);
          ctx.stroke();
          setHasInk(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      <div className="signature-pad-actions">
        <button
          className="icon-button"
          aria-label="Clear signature"
          title="Clear signature"
          disabled={disabled}
          onClick={() => {
            canvas.current!.getContext('2d')!.clearRect(0, 0, 600, 220);
            setHasInk(false);
          }}
        >
          <Eraser size={16} />
        </button>
        <button
          className="secondary small"
          disabled={disabled || !hasInk}
          onClick={() => onAdd(canvas.current!.toDataURL('image/png'))}
        >
          <Plus size={15} />
          Add signature
        </button>
      </div>
    </div>
  );
}
