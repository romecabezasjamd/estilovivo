import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Undo2, Check, Eraser, Paintbrush } from 'lucide-react';

interface BackgroundRemoverProps {
  imageUrl: string;
  onApply: (processedBlob: Blob) => void;
  onCancel: () => void;
}

const BackgroundRemover: React.FC<BackgroundRemoverProps> = ({ imageUrl, onApply, onCancel }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const [brushSize, setBrushSize] = useState(20);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState<'erase' | 'restore'>('erase');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const maxW = Math.min(window.innerWidth - 32, 500);
      const maxH = window.innerHeight * 0.55;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      setCanvasSize({ width: w, height: h });

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const overlay = overlayRef.current;
      if (overlay) {
        overlay.width = img.width;
        overlay.height = img.height;
      }
      saveHistory();
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current.push(data);
    if (historyRef.current.length > 30) historyRef.current.shift();
  };

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas || historyRef.current.length <= 1) return;
    historyRef.current.pop();
    const prev = historyRef.current[historyRef.current.length - 1];
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(prev, 0, 0);
  };

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = overlayRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }, []);

  const paint = useCallback((x: number, y: number) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext('2d')!;
    ctx.globalCompositeOperation = mode === 'erase' ? 'source-over' : 'destination-out';
    ctx.fillStyle = mode === 'erase' ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 255, 0, 0.4)';
    ctx.beginPath();
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }, [mode, brushSize]);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const pos = getPos(e);
    lastPosRef.current = pos;
    paint(pos.x, pos.y);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    if (lastPosRef.current) {
      const dx = pos.x - lastPosRef.current.x;
      const dy = pos.y - lastPosRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.floor(dist / (brushSize / 4)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        paint(lastPosRef.current.x + dx * t, lastPosRef.current.y + dy * t);
      }
    }
    lastPosRef.current = pos;
  };

  const handleEnd = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPosRef.current = null;
    // Apply the overlay mask to the actual canvas
    applyMask();
  };

  const applyMask = () => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const ctx = canvas.getContext('2d')!;
    const octx = overlay.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    const imgData = ctx.getImageData(0, 0, w, h);
    const maskData = octx.getImageData(0, 0, w, h);
    const pixels = imgData.data;
    const mask = maskData.data;

    for (let i = 0; i < mask.length; i += 4) {
      // Red pixels in overlay = erase (make transparent)
      if (mask[i] > 100 && mask[i + 1] < 50) {
        pixels[i + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    // Clear the overlay
    octx.clearRect(0, 0, w, h);
    saveHistory();
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) onApply(blob);
    }, 'image/png');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in">
      <div className="bg-[var(--bg-card)] rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-light)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Recortar fondo</h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
            <X size={16} />
          </button>
        </div>

        {/* Canvas area */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-50 relative">
          <div className="relative" style={{ width: canvasSize.width, height: canvasSize.height }}>
            <canvas
              ref={canvasRef}
              style={{ width: canvasSize.width, height: canvasSize.height }}
              className="rounded-xl"
            />
            <canvas
              ref={overlayRef}
              style={{ width: canvasSize.width, height: canvasSize.height }}
              className="absolute inset-0 rounded-xl cursor-crosshair touch-none"
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          </div>
        </div>

        {/* Tools */}
        <div className="p-4 border-t border-[var(--border-light)] space-y-3">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setMode('erase')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition ${
                mode === 'erase' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-gray-50 text-[var(--text-secondary)]'
              }`}
            >
              <Eraser size={14} />
              Borrar fondo
            </button>
            <button
              onClick={() => setMode('restore')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition ${
                mode === 'restore' ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-gray-50 text-[var(--text-secondary)]'
              }`}
            >
              <Paintbrush size={14} />
              Restaurar
            </button>
          </div>

          {/* Brush size */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-[var(--text-muted)] w-8">{brushSize}px</span>
            <input
              type="range"
              min="5"
              max="80"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none accent-primary"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={undo} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 text-[var(--text-secondary)] hover:bg-gray-200 transition">
              <Undo2 size={14} />
              Deshacer
            </button>
            <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 text-[var(--text-secondary)]">
              Cancelar
            </button>
            <button onClick={handleApply} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-primary text-white hover:opacity-90 transition flex items-center justify-center gap-1.5">
              <Check size={14} />
              Aplicar
            </button>
          </div>

          <p className="text-[10px] text-center text-[var(--text-muted)]">
            Pinta sobre el fondo en rojo para eliminarlo. Usa "Restaurar" si te pasas.
          </p>
        </div>
      </div>
    </div>
  );
};

export default BackgroundRemover;
