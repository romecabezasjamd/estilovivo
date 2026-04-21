import React, { useState, useRef, useEffect } from 'react';
import { Garment, UserState } from '../types';
import { X, Camera, RotateCw, ZoomIn, ZoomOut, Check, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';

interface FittingRoomModalProps {
  garment: Garment;
  user: UserState;
  onClose: () => void;
}

export default function FittingRoomModal({ garment, user, onClose }: FittingRoomModalProps) {
  const { t } = useLanguage();
  const [bgImage, setBgImage] = useState<string | null>(user.fullBodyAvatar || null);
  
  // Transform states
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Interaction refs
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchAngle = useRef<number | null>(null);
  const startScale = useRef(1);
  const startRotation = useRef(0);

  // Center the garment initially
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPos({ x: 0, y: 0 }); // Center assumes flex aligns it, but since it's absolute, let's keep it 0,0 relative to its default center position via flex context.
    }
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBgImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // --- MOUSE EVENTS (Desktop fallback) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setPos(p => ({ x: p.x + dx, y: p.y + dy }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Removed e.preventDefault() to prevent passive event listener error in console
    // Use shift+scroll to rotate instead of scale
    if (e.shiftKey) {
      setRotation(r => r + (e.deltaY > 0 ? 5 : -5));
    } else {
      setScale(s => Math.max(0.2, Math.min(s - e.deltaY * 0.005, 5)));
    }
  };

  // --- TOUCH EVENTS (Mobile Multi-Touch) ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      isDragging.current = false; // Stop dragging when pinching
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDist.current = Math.hypot(dx, dy);
      initialPinchAngle.current = Math.atan2(dy, dx) * (180 / Math.PI);
      startScale.current = scale;
      startRotation.current = rotation;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Prevent default scrolling during touch
    // Note: touch-none class on container already handles this without triggering passive event listener errors.

    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastPos.current.x;
      const dy = e.touches[0].clientY - lastPos.current.y;
      setPos(p => ({ x: p.x + dx, y: p.y + dy }));
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && initialPinchDist.current !== null && initialPinchAngle.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Calculate new scale
      const zoomFactor = dist / initialPinchDist.current;
      setScale(Math.max(0.2, Math.min(startScale.current * zoomFactor, 5)));

      // Calculate new rotation
      let angleDelta = angle - initialPinchAngle.current;
      // Handle wrap-around
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;
      setRotation(startRotation.current + angleDelta);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      isDragging.current = false;
      initialPinchDist.current = null;
      initialPinchAngle.current = null;
    } else if (e.touches.length === 1) {
      // Re-init simple drag if one finger remains
      isDragging.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialPinchDist.current = null;
      initialPinchAngle.current = null;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black animate-fade-in flex flex-col font-sans touch-none">
      {/* HEADER */}
      <div className="absolute top-0 w-full z-20 flex justify-between items-center p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button 
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white"
        >
          <X size={20} />
        </button>
        <span className="text-white text-sm font-bold tracking-widest uppercase">Tu Modelo Virtual</span>
        <div className="w-10" />
      </div>

      {/* RENDER AREA */}
      <div 
        ref={containerRef}
        className="flex-1 w-full h-full relative overflow-hidden flex items-center justify-center cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {/* Background Overlay Layer */}
        {bgImage ? (
          <img 
            src={bgImage} 
            alt="Modelo" 
            className="absolute w-full h-full object-contain opacity-90 pointer-events-none"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 px-8 text-center pointer-events-none">
            <Camera size={48} className="mb-4 opacity-50" />
            <p className="text-sm font-bold">No tienes modelo guardado.</p>
            <p className="text-xs mt-2">Usa el botón de abajo para subir una foto tuya de cuerpo entero y empezar a probarte ropa.</p>
          </div>
        )}

        {/* Selected Garment Layer */}
        <div 
          className="absolute origin-center will-change-transform shadow-2xl drop-shadow-2xl"
          style={{
            transform: `translate3d(${pos.x}px, ${pos.y}px, 0) scale(${scale}) rotate(${rotation}deg)`,
            transition: isDragging.current ? 'none' : 'transform 0.05s linear', // smooth drops
          }}
        >
          <img 
            src={garment.imageUrl} 
            alt={garment.name} 
            className="h-64 object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.5)] pointer-events-none"
            draggable="false"
          />
        </div>
      </div>

      {/* FOOTER CONTROLS */}
      <div className="absolute bottom-6 w-full z-20 px-6 flex flex-col items-center gap-4">
        <div className="flex gap-4">
           {/* If they want manual control buttons */}
           <button onClick={() => setScale(s => Math.max(0.2, s - 0.1))} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white p-2 active:bg-white/40 border border-white/10">
             <ZoomOut size={20} />
           </button>
           <button onClick={() => setRotation(r => r + 15)} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white p-2 active:bg-white/40 border border-white/10">
             <RotateCw size={20} />
           </button>
           <button onClick={() => setScale(s => Math.min(5, s + 0.1))} className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white p-2 active:bg-white/40 border border-white/10">
             <ZoomIn size={20} />
           </button>
        </div>

        <div className="w-full flex gap-3">
          <label className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-white/20">
            <Camera size={16} />
            <span className="text-xs uppercase tracking-widest">{bgImage ? 'Cambiar Foto' : 'Subir Foto'}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
          <button 
            onClick={onClose}
            className="flex-1 bg-primary text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-pink-600 shadow-lg shadow-primary/30"
          >
            <Check size={16} />
            <span className="text-xs uppercase tracking-widest">¡Me gusta!</span>
          </button>
        </div>
      </div>

    </div>
  );
}
