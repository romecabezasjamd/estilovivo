import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Garment, UserState } from '../types';
import { X, Camera as CameraIcon, RotateCw, ZoomIn, ZoomOut, Check, Plus, Layers, FlipHorizontal, RefreshCcw, ImageIcon } from 'lucide-react';
import { CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { useLanguage } from '../src/context/LanguageContext';
import { useGlobalState } from '../src/context/GlobalStateContext';
import html2canvas from 'html2canvas';
import { api } from '../services/api';
import { pickPhoto } from '../src/utils/cameraPhoto';

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
  const { garments, setUser } = useGlobalState();
  
  const [bgImage, setBgImage] = useState<string | null>(user.fullBodyAvatar || null);

  useEffect(() => {
    if (user.fullBodyAvatar) {
      setBgImage(user.fullBodyAvatar);
    }
  }, [user.fullBodyAvatar]);
  
  // Transform states
  const [items, setItems] = useState<InteractiveGarment[]>([
    { id: Date.now().toString(), garment: initialGarment, pos: { x: 0, y: 0 }, scale: 1, rotation: 0, flipped: false }
  ]);
  const [activeId, setActiveId] = useState<string | null>(() => items[0]?.id || null);

  // UI Flow states
  const [showPicker, setShowPicker] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [lookName, setLookName] = useState('');
  const [savingMsg, setSavingMsg] = useState('');
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);

  // Interaction refs
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchAngle = useRef<number | null>(null);
  const startScale = useRef(1);
  const startRotation = useRef(0);

  const persistModelPhoto = async (file: File, previewUrl: string) => {
    setBgImage(previewUrl);
    setModelError(null);
    triggerHaptic('success');

    try {
      const formData = new FormData();
      formData.append('fullBodyAvatar', file);
      const updated = await api.updateProfileWithAvatar(formData);
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, fullBodyAvatar: updated.fullBodyAvatar };
        localStorage.setItem('beyour_user', JSON.stringify(next));
        return next;
      });
    } catch (uploadErr) {
      console.warn('Could not save full body avatar', uploadErr);
      setModelError('La foto se muestra aquí pero no se guardó en tu perfil. Inténtalo de nuevo.');
    }
  };

  const handleModelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        persistModelPhoto(file, reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const captureModelPhoto = async (source: CameraSource) => {
    if (isTakingPhoto) return;
    setIsTakingPhoto(true);
    setModelError(null);
    try {
      const { dataUrl, file } = await pickPhoto(source);
      await persistModelPhoto(file, dataUrl);
    } catch (err: any) {
      const message = String(err?.message || err || '');
      if (!message.toLowerCase().includes('cancel')) {
        setModelError('No se pudo obtener la foto. Revisa permisos de cámara y galería.');
      }
    } finally {
      setIsTakingPhoto(false);
    }
  };

  const triggerHaptic = (type: 'light' | 'medium' | 'success' = 'light') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'light') navigator.vibrate(10);
      else if (type === 'medium') navigator.vibrate(20);
      else if (type === 'success') navigator.vibrate([10, 30, 10]);
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
    triggerHaptic('medium');
  };

  const handleRemoveItem = (id: string, e?: React.MouseEvent | React.TouchEvent) => {
    e?.stopPropagation();
    setItems(prev => {
        const next = prev.filter(i => i.id !== id);
        if (activeId === id) setActiveId(next.length ? next[next.length - 1].id : null);
        return next;
    });
    triggerHaptic('light');
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
        triggerHaptic('light');
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
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/10"
        >
          <X size={20} />
        </button>
        <span className="text-white text-xs font-bold tracking-[0.2em] uppercase opacity-90">Probador Virtual</span>
        <button
          type="button"
          onClick={() => captureModelPhoto(CameraSource.Camera)}
          disabled={isTakingPhoto}
          title="Cambiar foto de cuerpo entero"
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 text-white backdrop-blur-md border border-white/10 disabled:opacity-50"
        >
          {isTakingPhoto ? <RefreshCcw size={20} className="animate-spin" /> : <CameraIcon size={20} />}
        </button>
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
        {bgImage ? (
          <img
            src={bgImage}
            alt="Tu foto de cuerpo entero"
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 px-8 text-center pointer-events-none">
            <CameraIcon size={48} className="mb-4 opacity-40" />
            <p className="text-sm font-bold">Añade tu foto de cuerpo entero</p>
            <p className="text-xs mt-2 max-w-xs">Después podrás colocar y ajustar las prendas encima, como en un probador.</p>
          </div>
        )}

        {/* Selected Garment Layers */}
        {items.map((item) => (
            <div 
              key={item.id}
              onMouseDown={(e) => { e.stopPropagation(); setActiveId(item.id); triggerHaptic('light'); }}
              onTouchStart={(e) => { e.stopPropagation(); setActiveId(item.id); triggerHaptic('light'); }}
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 origin-center will-change-transform ${activeId === item.id ? 'z-10' : 'z-0'}`}
              style={{
                transform: `translate3d(${item.pos.x}px, ${item.pos.y}px, 0) scale(${item.scale}) rotate(${item.rotation}deg) ${item.flipped ? 'scaleX(-1)' : ''}`,
                transition: isDragging.current ? 'none' : 'transform 0.05s linear',
                filter: 'drop-shadow(0 15px 25px rgba(0,0,0,0.35))'
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
                className="h-64 object-contain pointer-events-none"
                draggable="false"
              />
            </div>
        ))}
      </div>

      {/* FOOTER CONTROLS */}
      <div className="absolute bottom-6 w-full z-20 px-6 flex flex-col items-center gap-4">
        <div className="flex gap-2 flex-wrap justify-center">
           <button onClick={() => handleModifier('zoomOut')} className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/10 active:bg-white/30 transition-colors">
             <ZoomOut size={18} />
           </button>
           <button onClick={() => handleModifier('zoomIn')} className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/10 active:bg-white/30 transition-colors">
             <ZoomIn size={18} />
           </button>
           <button onClick={() => handleModifier('rotate')} className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/10 active:bg-white/30 transition-colors">
             <RotateCw size={18} />
           </button>
           <button onClick={() => handleModifier('flip')} title="Voltear" className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/10 active:bg-white/30 transition-colors">
             <FlipHorizontal size={18} />
           </button>
           <button 
             onClick={() => {
               if (!activeId) return;
               setItems(prev => prev.map(item => item.id === activeId ? { ...item, pos: { x: 0, y: 0 }, scale: 1, rotation: 0 } : item));
               triggerHaptic('medium');
             }}
             title="Centrar"
             className="p-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/10 active:bg-white/30 transition-colors"
           >
             <RefreshCcw size={18} />
           </button>
           <div className="w-[1px] h-10 bg-white/10 mx-1" />
           <button 
             onClick={() => setShowLayers(!showLayers)} 
             className={`p-3 rounded-full border transition-all ${showLayers ? 'bg-primary text-white border-primary' : 'bg-white/10 backdrop-blur-md text-white border border-white/10'}`}
           >
             <Layers size={18} />
           </button>
        </div>

        {modelError && (
          <p className="text-xs text-red-300 font-medium text-center px-2">{modelError}</p>
        )}

        <div className="w-full flex flex-col gap-3">
          {!bgImage ? (
            <>
              {Capacitor.getPlatform() !== 'web' ? (
                <div className="flex gap-2 w-full">
                  <button
                    type="button"
                    disabled={isTakingPhoto}
                    onClick={() => captureModelPhoto(CameraSource.Camera)}
                    className="flex-1 bg-primary text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CameraIcon size={16} />
                    <span className="text-xs uppercase tracking-widest">Cámara</span>
                  </button>
                  <button
                    type="button"
                    disabled={isTakingPhoto}
                    onClick={() => captureModelPhoto(CameraSource.Photos)}
                    className="flex-1 bg-white/15 backdrop-blur-md border border-white/20 text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <ImageIcon size={16} />
                    <span className="text-xs uppercase tracking-widest">Galería</span>
                  </button>
                </div>
              ) : null}
              <label className="w-full bg-white/10 backdrop-blur-md border border-white/20 text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-white/20">
                <ImageIcon size={16} />
                <span className="text-xs uppercase tracking-widest">
                  {Capacitor.getPlatform() === 'web' ? 'Subir foto de cuerpo entero' : 'O subir archivo'}
                </span>
                <input
                  ref={modelFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleModelFileUpload}
                />
              </label>
            </>
          ) : (
            <div className="flex gap-2 w-full">
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-white/20"
              >
                <Plus size={16} />
                <span className="text-xs uppercase tracking-widest">Prenda</span>
              </button>
              <button
                type="button"
                onClick={() => { setActiveId(null); setShowNamePrompt(true); }}
                className="flex-1 bg-primary text-white py-3 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-pink-600 shadow-lg shadow-primary/30"
              >
                <Check size={16} />
                <span className="text-xs uppercase tracking-widest">¡Me gusta!</span>
              </button>
            </div>
          )}
          {bgImage && Capacitor.getPlatform() !== 'web' && (
            <div className="flex gap-2 w-full">
              <button
                type="button"
                disabled={isTakingPhoto}
                onClick={() => captureModelPhoto(CameraSource.Camera)}
                className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
              >
                Nueva foto (cámara)
              </button>
              <button
                type="button"
                disabled={isTakingPhoto}
                onClick={() => captureModelPhoto(CameraSource.Photos)}
                className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
              >
                Desde galería
              </button>
            </div>
          )}
        </div>
      </div>

      {/* LAYERS PANEL */}
      <AnimatePresence>
        {showLayers && (
            <motion.div 
                initial={{ x: 300 }}
                animate={{ x: 0 }}
                exit={{ x: 300 }}
                className="absolute right-0 top-24 bottom-32 w-20 bg-black/40 backdrop-blur-xl border-l border-white/10 z-30 flex flex-col items-center py-4 gap-4 overflow-y-auto no-scrollbar"
            >
                <div className="text-[8px] font-bold text-white/50 uppercase tracking-widest vertical-text mb-2">Capas</div>
                {[...items].reverse().map((item, idx) => (
                    <div 
                        key={item.id}
                        onClick={() => { setActiveId(item.id); triggerHaptic('light'); }}
                        className={`relative w-14 h-14 rounded-xl border-2 transition-all overflow-hidden flex-shrink-0 ${activeId === item.id ? 'border-primary ring-2 ring-primary/30' : 'border-white/10 opacity-60'}`}
                    >
                        <img src={item.garment.imageUrl} className="w-full h-full object-contain p-1" />
                        <div className="absolute bottom-0 right-0 bg-black/60 text-[8px] text-white px-1 font-bold">
                            {items.length - idx}
                        </div>
                    </div>
                ))}
            </motion.div>
        )}
      </AnimatePresence>

      {/* GARMENT PICKER DRAWER */}
      <AnimatePresence>
        {showPicker && (
            <motion.div 
                initial={{ y: 300 }}
                animate={{ y: 0 }}
                exit={{ y: 300 }}
                className="absolute bottom-0 w-full bg-black/80 backdrop-blur-2xl rounded-t-[2.5rem] border-t border-white/20 p-6 z-50 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
            >
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
                <div className="flex justify-between items-center mb-6 px-2">
                    <h3 className="text-white font-bold text-lg tracking-tight">Añadir Prenda</h3>
                    <button 
                        onClick={() => setShowPicker(false)} 
                        className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white"
                    >
                        <X size={18} />
                    </button>
                </div>
                
                {garments.length === 0 ? (
                    <p className="text-white/50 text-center text-sm py-12">No tienes más prendas en el armario.</p>
                ) : (
                    <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar snap-x">
                    {garments.map(g => (
                        <motion.div 
                        whileHover={{ y: -5 }}
                        whileTap={{ scale: 0.95 }}
                        key={g.id} 
                        onClick={() => handleAddGarment(g)} 
                        className="flex-shrink-0 w-24 h-24 bg-white/5 rounded-3xl border border-white/10 p-3 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors snap-center"
                        >
                            <img src={g.imageUrl} className="max-w-full max-h-full object-contain drop-shadow-2xl pointer-events-none" />
                        </motion.div>
                    ))}
                    </div>
                )}
            </motion.div>
        )}
      </AnimatePresence>

      {/* SAVE PROMPT */}
      <AnimatePresence>
        {showNamePrompt && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 z-[200] flex items-center justify-center p-6 backdrop-blur-md"
            >
                <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm flex flex-col gap-6 shadow-2xl"
                >
                    <div className="text-center">
                        <h3 className="font-bold text-2xl text-gray-900">¡Look espectacular!</h3>
                        <p className="text-sm text-gray-500 mt-1">Dale un nombre a tu creación</p>
                    </div>
                    
                    {savingMsg ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-4">
                            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            <span className="font-bold text-primary">{savingMsg}</span>
                        </div>
                    ) : (
                        <>
                            <input 
                                type="text" 
                                placeholder="Ej: Outfit cena viernes ✨" 
                                value={lookName} 
                                onChange={e => setLookName(e.target.value)} 
                                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-4 text-base focus:outline-none focus:border-primary transition-colors font-medium text-black"
                                autoFocus
                            />
                            <div className="flex gap-3">
                                <button 
                                onClick={() => { setShowNamePrompt(false); setActiveId(items.length ? items[items.length-1].id : null); }} 
                                className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                                >
                                    Volver
                                </button>
                                <button 
                                onClick={handleSaveComposite} 
                                disabled={!lookName.trim()}
                                className="flex-1 py-4 bg-primary text-white rounded-2xl font-bold disabled:opacity-50 hover:bg-pink-600 shadow-xl shadow-primary/30 transition-all"
                                >
                                    Guardar
                                </button>
                            </div>
                        </>
                    )}
                </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
