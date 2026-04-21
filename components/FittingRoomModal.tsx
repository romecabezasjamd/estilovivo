import React, { useState, useRef, useEffect } from 'react';
import { Garment, UserState } from '../types';
import { X, Camera, RotateCw, ZoomIn, ZoomOut, Check, ArrowLeft, Plus, Save, Layers, FlipHorizontal } from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';
import { useGlobalState } from '../src/context/GlobalStateContext';
import html2canvas from 'html2canvas';
import { api } from '../services/api';

interface FittingRoomModalProps {
  garment: Garment;
  user: UserState;
  onClose: () => void;
}

interface InteractiveGarment {
  id: string; // unique instance ID
  garment: Garment;
  pos: { x: number, y: number };
  scale: number;
  rotation: number;
  flipped?: boolean;
}

export default function FittingRoomModal({ garment: initialGarment, user, onClose }: FittingRoomModalProps) {
  const { t } = useLanguage();
  const { garments } = useGlobalState();
  
  const [bgImage, setBgImage] = useState<string | null>(user.fullBodyAvatar || null);
  
  // Transform states
  const [items, setItems] = useState<InteractiveGarment[]>([
    { id: Date.now().toString(), garment: initialGarment, pos: { x: 0, y: 0 }, scale: 1, rotation: 0, flipped: false }
  ]);
  const [activeId, setActiveId] = useState<string | null>(() => items[0]?.id || null);

  // UI Flow states
  const [showPicker, setShowPicker] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [lookName, setLookName] = useState('');
  const [savingMsg, setSavingMsg] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  // Interaction refs
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchAngle = useRef<number | null>(null);
  const startScale = useRef(1);
  const startRotation = useRef(0);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setBgImage(reader.result as string);
      reader.readAsDataURL(file);

      try {
        const formData = new FormData();
        formData.append('fullBodyAvatar', file);
        await api.updateProfileWithAvatar(formData);
      } catch (err) {
        console.warn('Could not save avatar directly', err);
      }
    }
  };

  const syncAnimationStarts = () => {
    const activeItem = items.find(i => i.id === activeId);
    if (activeItem) {
        startScale.current = activeItem.scale;
        startRotation.current = activeItem.rotation;
    }
  }

  // --- MOUSE EVENTS (Desktop fallback) ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !activeId) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    setItems(prev => prev.map(item => item.id === activeId ? { ...item, pos: { x: item.pos.x + dx, y: item.pos.y + dy } } : item));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!activeId) return;
    // Use shift+scroll to rotate instead of scale
    setItems(prev => prev.map(item => {
      if (item.id === activeId) {
        if (e.shiftKey) {
          return { ...item, rotation: item.rotation + (e.deltaY > 0 ? 5 : -5) };
        } else {
          return { ...item, scale: Math.max(0.2, Math.min(item.scale - e.deltaY * 0.005, 5)) };
        }
      }
      return item;
    }));
  };

  // --- TOUCH EVENTS (Mobile Multi-Touch) ---
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && activeId) {
      isDragging.current = false; // Stop simple dragging when pinching
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDist.current = Math.hypot(dx, dy);
      initialPinchAngle.current = Math.atan2(dy, dx) * (180 / Math.PI);
      syncAnimationStarts();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!activeId) return;

    if (e.touches.length === 1 && isDragging.current) {
      const dx = e.touches[0].clientX - lastPos.current.x;
      const dy = e.touches[0].clientY - lastPos.current.y;
      setItems(prev => prev.map(item => item.id === activeId ? { ...item, pos: { x: item.pos.x + dx, y: item.pos.y + dy } } : item));
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2 && initialPinchDist.current !== null && initialPinchAngle.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      const zoomFactor = dist / initialPinchDist.current;
      let angleDelta = angle - initialPinchAngle.current;
      if (angleDelta > 180) angleDelta -= 360;
      if (angleDelta < -180) angleDelta += 360;

      setItems(prev => prev.map(item => {
        if (item.id === activeId) {
          return {
            ...item,
            scale: Math.max(0.2, Math.min(startScale.current * zoomFactor, 5)),
            rotation: startRotation.current + angleDelta
          };
        }
        return item;
      }));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      isDragging.current = false;
      initialPinchDist.current = null;
      initialPinchAngle.current = null;
    } else if (e.touches.length === 1) {
      isDragging.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      initialPinchDist.current = null;
      initialPinchAngle.current = null;
    }
  };

  // --- ACTIONS ---
  const handleAddGarment = (g: Garment) => {
    const newId = Date.now().toString();
    setItems(prev => [...prev, { id: newId, garment: g, pos: { x: 0, y: 0 }, scale: 1, rotation: 0, flipped: false }]);
    setActiveId(newId);
    setShowPicker(false);
  };

  const handleRemoveItem = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setItems(prev => {
        const next = prev.filter(i => i.id !== id);
        if (activeId === id) setActiveId(next.length ? next[next.length - 1].id : null);
        return next;
    });
  };

  const handleModifier = (action: 'zoomIn' | 'zoomOut' | 'rotate' | 'flip' | 'forward' | 'backward') => {
    if (!activeId) return;
    
    if (action === 'forward' || action === 'backward') {
      setItems(prev => {
        const idx = prev.findIndex(i => i.id === activeId);
        if (idx === -1) return prev;
        const newItems = [...prev];
        const [removed] = newItems.splice(idx, 1);
        if (action === 'forward') {
           newItems.splice(Math.min(newItems.length, idx + 1), 0, removed);
        } else {
           newItems.splice(Math.max(0, idx - 1), 0, removed);
        }
        return newItems;
      });
      return;
    }

    setItems(prev => prev.map(item => {
      if (item.id === activeId) {
        if (action === 'zoomOut') return { ...item, scale: Math.max(0.2, item.scale - 0.1) };
        if (action === 'zoomIn') return { ...item, scale: Math.min(5, item.scale + 0.1) };
        if (action === 'rotate') return { ...item, rotation: item.rotation + 15 };
        if (action === 'flip') return { ...item, flipped: !item.flipped };
      }
      return item;
    }));
  };

  const handleSaveComposite = async () => {
    if (!lookName.trim() || items.length === 0) return;
    setSavingMsg('Generando imagen...');
    try {
      if (!containerRef.current) return;
      
      const canvas = await html2canvas(containerRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#000', // Match bg-black
      });
      
      canvas.toBlob(async (blob) => {
        if (!blob) throw new Error('Blob generation failed');
        setSavingMsg('Guardando en tu armario...');
        
        // Collect unique garment IDs
        const productIds = Array.from<string>(new Set(items.map(i => i.garment.id)));
        
        await api.saveLookWithImage(lookName, productIds, blob);
        
        setSavingMsg('¡Guardado con éxito!');
        setTimeout(() => {
          onClose(); // Automatically close after success
          window.location.reload(); // Quick refresh to show in looks
        }, 1500);
      }, 'image/png');
    } catch (e) {
        console.error('Error saving composite', e);
        setSavingMsg('Error al guardar. Intenta de nuevo.');
        setTimeout(() => setSavingMsg(''), 2000);
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

      {/* RENDER AREA (We target this ref directly for html2canvas) */}
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
            <p className="text-xs mt-2">Usa el botón de abajo para subir una foto tuya de cuerpo entero.</p>
          </div>
        )}

        {/* Selected Garment Layers */}
        {items.map((item) => (
            <div 
              key={item.id}
              onClick={(e) => { e.stopPropagation(); setActiveId(item.id); }}
              onTouchStart={(e) => { e.stopPropagation(); setActiveId(item.id); }}
              className={`absolute origin-center will-change-transform shadow-2xl drop-shadow-2xl ${activeId === item.id ? 'z-10' : 'z-0'}`}
              style={{
                transform: `translate3d(${item.pos.x}px, ${item.pos.y}px, 0) scale(${item.scale}) rotate(${item.rotation}deg) ${item.flipped ? 'scaleX(-1)' : ''}`,
                transition: isDragging.current ? 'none' : 'transform 0.05s linear',
              }}
            >
              {/* Active Selection Outline */}
              {activeId === item.id && !showNamePrompt && (
                  <div className="absolute -inset-1 border border-white/40 border-dashed rounded-lg pointer-events-none"></div>
              )}
              {/* Remove Button */}
              {activeId === item.id && !showNamePrompt && (
                  <button 
                    onClick={(e) => handleRemoveItem(item.id, e)}
                    onTouchEnd={(e) => handleRemoveItem(item.id, e)}
                    className="absolute -top-3 -right-3 bg-red-500 w-6 h-6 rounded-full flex items-center justify-center text-white shadow-lg pointer-events-auto"
                  >
                      <X size={14} />
                  </button>
              )}
              
              <img 
                src={item.garment.imageUrl} 
                alt={item.garment.name} 
                className="h-64 object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.5)] mix-blend-multiply pointer-events-none"
                draggable="false"
              />
            </div>
        ))}
      </div>

      {/* FOOTER CONTROLS */}
      <div className="absolute bottom-6 w-full z-20 px-6 flex flex-col items-center gap-4">
        <div className="flex gap-2 flex-wrap justify-center">
           <button onClick={() => handleModifier('zoomOut')} className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/10 active:bg-white/40">
             <ZoomOut size={18} />
           </button>
           <button onClick={() => handleModifier('zoomIn')} className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/10 active:bg-white/40">
             <ZoomIn size={18} />
           </button>
           <button onClick={() => handleModifier('rotate')} className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/10 active:bg-white/40">
             <RotateCw size={18} />
           </button>
           <button onClick={() => handleModifier('flip')} title="Voltear" className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/10 active:bg-white/40">
             <FlipHorizontal size={18} />
           </button>
           <div className="w-[1px] h-10 bg-white/10 mx-1" />
           <button onClick={() => handleModifier('backward')} title="Enviar atrás" className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/10 active:bg-white/40">
             <Layers size={18} className="rotate-180" />
           </button>
           <button onClick={() => handleModifier('forward')} title="Traer adelante" className="p-3 rounded-full bg-white/20 backdrop-blur-md text-white border border-white/10 active:bg-white/40">
             <Layers size={18} />
           </button>
        </div>

        <div className="w-full flex gap-3">
          {(!bgImage) ? (
            <label className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-white/20">
                <Camera size={16} />
                <span className="text-xs uppercase tracking-widest">Subir Modelo</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          ) : (
            <>
                <button 
                  onClick={() => setShowPicker(true)}
                  className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/20"
                >
                  <Plus size={16} />
                  <span className="text-xs uppercase tracking-widest">Añadir</span>
                </button>
                <button 
                  onClick={() => { setActiveId(null); setShowNamePrompt(true); }}
                  className="flex-1 bg-primary text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-pink-600 shadow-lg shadow-primary/30"
                >
                  <Check size={16} />
                  <span className="text-xs uppercase tracking-widest">¡Me gusta!</span>
                </button>
            </>
          )}
        </div>
      </div>

      {/* GARMENT PICKER DRAWER */}
      {showPicker && (
        <div className="absolute bottom-0 w-full bg-black/60 backdrop-blur-2xl rounded-t-3xl border-t border-white/10 p-6 z-50 animate-fade-in-up">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold text-sm tracking-widest uppercase">Tu Armario</h3>
                <button onClick={() => setShowPicker(false)} className="bg-white/10 rounded-full p-1 text-white">
                    <X size={18} />
                </button>
            </div>
            
            {garments.length === 0 ? (
                <p className="text-white/50 text-center text-sm py-8">No tienes más prendas en el armario.</p>
            ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar" style={{WebkitOverflowScrolling: 'touch'}}>
                {garments.map(g => (
                    <div 
                      key={g.id} 
                      onClick={() => handleAddGarment(g)} 
                      className="flex-shrink-0 w-20 h-20 bg-white/10 rounded-2xl border border-white/5 p-2 flex items-center justify-center cursor-pointer hover:bg-white/20 transition-colors"
                    >
                        <img src={g.imageUrl} className="max-w-full max-h-full object-contain drop-shadow-md pointer-events-none" />
                    </div>
                ))}
                </div>
            )}
        </div>
      )}

      {/* SAVE PROMPT */}
      {showNamePrompt && (
        <div className="absolute inset-0 bg-black/80 z-[200] flex items-center justify-center p-6 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
                <h3 className="font-bold text-xl text-gray-800 text-center">Guardar Outfit</h3>
                {savingMsg ? (
                    <div className="flex items-center justify-center py-6">
                        <span className="animate-pulse font-bold text-primary text-lg">{savingMsg}</span>
                    </div>
                ) : (
                    <>
                        <input 
                            type="text" 
                            placeholder="Ej: Conjunto de verano..." 
                            value={lookName} 
                            onChange={e => setLookName(e.target.value)} 
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium text-black"
                            autoFocus
                        />
                        <div className="flex gap-3 mt-2">
                            <button 
                              onClick={() => { setShowNamePrompt(false); setActiveId(items.length ? items[items.length-1].id : null); }} 
                              className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                              onClick={handleSaveComposite} 
                              disabled={!lookName.trim()}
                              className="flex-1 py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50 hover:bg-pink-600 shadow-md shadow-primary/30 transition-all"
                            >
                                Guardar
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
      )}

    </div>
  );
}
