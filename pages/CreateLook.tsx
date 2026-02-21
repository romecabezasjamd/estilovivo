import React, { useState, useMemo } from 'react';
import { Garment, Look } from '../types';
import { X, Save, Wand2, Shuffle, Plus, Globe, Lock, Tag, Sparkles } from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';

interface CreateLookProps {
  garments: Garment[];
  onSaveLook: (look: Look) => void;
}

const CATEGORY_ORDER = ['top', 'outerwear', 'bottom', 'dress', 'shoes', 'accessories'];

const CreateLook: React.FC<CreateLookProps> = ({ garments, onSaveLook }) => {
  const { t } = useLanguage();
  const [selectedItems, setSelectedItems] = useState<Garment[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lookName, setLookName] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [mood, setMood] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [pickerFilter, setPickerFilter] = useState('all');

  const MOOD_OPTIONS = [
    { id: 'happy', emoji: '😊', label: t('happy') },
    { id: 'bold', emoji: '🔥', label: t('bold') },
    { id: 'chill', emoji: '🌿', label: t('chill') },
    { id: 'romantic', emoji: '🌸', label: t('romantic') },
    { id: 'elegant', emoji: '✨', label: t('elegant') },
    { id: 'casual', emoji: '☕', label: t('casual') },
    { id: 'sport', emoji: '👟', label: t('sport') },
  ];

  // Filter garments in the picker
  const filteredGarments = useMemo(() => {
    if (pickerFilter === 'all') return garments;
    return garments.filter(g => g.type === pickerFilter);
  }, [garments, pickerFilter]);

  // Available categories from user's garments
  const availableCategories = useMemo(() => {
    const cats = new Set(garments.map(g => g.type));
    return ['all', ...CATEGORY_ORDER.filter(c => cats.has(c))];
  }, [garments]);

  const toggleItem = (item: Garment) => {
    if (selectedItems.find(i => i.id === item.id)) {
      setSelectedItems(selectedItems.filter(i => i.id !== item.id));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  // Random mix: pick one from each category available
  const handleShuffle = () => {
    const byCategory: Record<string, Garment[]> = {};
    garments.forEach(g => {
      if (!byCategory[g.type]) byCategory[g.type] = [];
      byCategory[g.type].push(g);
    });

    const randomPicks: Garment[] = [];
    // Try to pick top + bottom or a dress
    const hasDress = byCategory['dress']?.length;
    const useFullOutfit = hasDress && Math.random() > 0.5;

    if (useFullOutfit) {
      const dresses = byCategory['dress'];
      randomPicks.push(dresses[Math.floor(Math.random() * dresses.length)]);
    } else {
      if (byCategory['top']?.length) {
        randomPicks.push(byCategory['top'][Math.floor(Math.random() * byCategory['top'].length)]);
      }
      if (byCategory['bottom']?.length) {
        randomPicks.push(byCategory['bottom'][Math.floor(Math.random() * byCategory['bottom'].length)]);
      }
    }

    // Optionally add outerwear
    if (byCategory['outerwear']?.length && Math.random() > 0.5) {
      randomPicks.push(byCategory['outerwear'][Math.floor(Math.random() * byCategory['outerwear'].length)]);
    }

    // Add shoes
    if (byCategory['shoes']?.length) {
      randomPicks.push(byCategory['shoes'][Math.floor(Math.random() * byCategory['shoes'].length)]);
    }

    // Maybe accessories
    if (byCategory['accessories']?.length && Math.random() > 0.5) {
      randomPicks.push(byCategory['accessories'][Math.floor(Math.random() * byCategory['accessories'].length)]);
    }

    if (randomPicks.length > 0) {
      setSelectedItems(randomPicks);
    }
  };

  const addTag = () => {
    const tInput = tagInput.trim().toLowerCase();
    if (tInput && !tags.includes(tInput) && tags.length < 5) {
      setTags([...tags, tInput]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = () => {
    const newLook: Look = {
      id: `l-${Date.now()}`,
      name: lookName || t('untitled') || 'Sin título',
      garmentIds: selectedItems.map(g => g.id),
      garments: selectedItems,
      tags: tags.length > 0 ? tags : ['custom'],
      mood: mood || undefined,
      isPublic,
      createdAt: new Date().toISOString(),
    };
    onSaveLook(newLook);
    // Reset
    setSelectedItems([]);
    setLookName('');
    setIsPublic(false);
    setMood('');
    setTags([]);
    setIsSaving(false);
  };

  // Sort selected items by category order for nice canvas display
  const sortedSelected = useMemo(() => {
    return [...selectedItems].sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.type);
      const bi = CATEGORY_ORDER.indexOf(b.type);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [selectedItems]);

  const categoryLabels: Record<string, string> = {
    all: t('all'),
    top: t('tops'),
    bottom: t('bottoms'),
    shoes: t('shoes'),
    outerwear: t('outerwear'),
    accessories: t('accessories'),
    dress: t('dresses'),
  };

  return (
    <div className="h-full flex flex-col bg-white relative">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white z-20">
        <button
          onClick={() => setSelectedItems([])}
          className="text-gray-400 hover:text-red-500 transition"
          title={t('clear')}
        >
          <X size={24} />
        </button>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleShuffle}
            className="flex items-center gap-1 text-gray-500 hover:text-pink-500 transition bg-gray-50 px-3 py-1.5 rounded-full"
            title={t('mix')}
          >
            <Shuffle size={16} />
            <span className="text-xs font-medium">{t('mix')}</span>
          </button>
          <button
            onClick={() => setIsSaving(true)}
            className={`text-sm font-semibold px-4 py-1.5 rounded-full transition-colors flex items-center gap-1 ${selectedItems.length > 0
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-gray-100 text-gray-400'
              }`}
            disabled={selectedItems.length === 0}
          >
            <Save size={16} /> {t('save')}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-gradient-to-b from-slate-50 to-gray-100 relative overflow-hidden p-6 flex items-center justify-center">
        {selectedItems.length === 0 ? (
          <div className="text-center opacity-50">
            <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Sparkles size={32} className="text-gray-300" />
            </div>
            <p className="font-medium text-lg text-gray-500">{t('canvasEmpty')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('canvasEmptyDesc')}</p>
          </div>
        ) : (
          <div className="relative w-full h-full max-w-sm mx-auto">
            {/* Show items as layered outfit */}
            {sortedSelected.map((item, index) => {
              const total = sortedSelected.length;
              const itemHeight = Math.min(160, (100 / Math.max(total, 2)) * 2.5);
              return (
                <div
                  key={item.id}
                  className="absolute shadow-xl rounded-xl bg-white p-1 transition-all duration-500 hover:z-50 hover:scale-110 cursor-pointer"
                  style={{
                    width: `${itemHeight}px`,
                    height: `${itemHeight}px`,
                    top: `${8 + (index * (70 / total))}%`,
                    left: `${50 - itemHeight / 5 + (index % 2 === 0 ? -15 : 15)}%`,
                    zIndex: index + 1,
                    transform: `rotate(${index % 2 === 0 ? -4 : 4}deg)`,
                  }}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleItem(item); }}
                    className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1 z-10 shadow-sm hover:bg-rose-600"
                  >
                    <X size={12} />
                  </button>
                  <img src={item.imageUrl} className="w-full h-full object-cover rounded-lg" alt={item.name || item.type} />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent rounded-b-lg p-1">
                    <p className="text-white text-[9px] font-medium truncate text-center">{item.name || item.type}</p>
                  </div>
                </div>
              );
            })}

            {/* Item count badge */}
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm">
              <p className="text-xs font-bold text-gray-600">{selectedItems.length} {t('garmentCount')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Garment Picker Drawer */}
      <div className={`bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-3xl z-10 transition-all duration-500 ease-in-out flex flex-col ${isPickerOpen ? 'h-72' : 'h-16'}`}>
        <button
          onClick={() => setIsPickerOpen(!isPickerOpen)}
          className="w-full flex justify-center py-2"
        >
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </button>

        <div className="px-5 pb-2 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">{t('yourWardrobe')}</h3>
          <span className="text-xs text-gray-400">{garments.length} {t('garmentCount')}</span>
        </div>

        {/* Picker category filter */}
        {isPickerOpen && (
          <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
            {availableCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setPickerFilter(cat)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition ${pickerFilter === cat
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-400'
                  }`}
              >
                {categoryLabels[cat] || cat}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-x-auto no-scrollbar px-4 pb-4">
          <div className="flex space-x-3">
            {filteredGarments.length === 0 ? (
              <div className="flex items-center justify-center w-full py-6">
                <p className="text-sm text-gray-300">{t('noGarmentsInCategory')}</p>
              </div>
            ) : (
              filteredGarments.map((item) => {
                const isSelected = selectedItems.some(i => i.id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className={`flex-shrink-0 w-24 h-32 rounded-xl overflow-hidden relative group border-2 transition-all ${isSelected
                        ? 'border-primary ring-2 ring-primary/30 opacity-60'
                        : 'border-transparent hover:border-gray-200'
                      }`}
                  >
                    <img src={item.imageUrl} className="w-full h-full object-cover" alt={item.name || item.type} />
                    {isSelected ? (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="bg-primary text-white rounded-full p-1">
                          <X size={14} />
                        </div>
                      </div>
                    ) : (
                      <div className="absolute bottom-1 right-1 bg-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition">
                        <Plus size={14} className="text-primary" />
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-1">
                      <p className="text-white text-[9px] truncate">{item.name || item.type}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Save Modal */}
      {isSaving && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold">{t('saveLook')}</h2>
              <button onClick={() => setIsSaving(false)}>
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            {/* Look name */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t('lookName')}</label>
              <input
                type="text"
                placeholder={t('lookNamePlaceholder')}
                className="w-full bg-gray-50 rounded-xl p-3.5 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                value={lookName}
                onChange={(e) => setLookName(e.target.value)}
              />
            </div>

            {/* Mood */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t('lookMood')}</label>
              <div className="flex gap-2 flex-wrap">
                {MOOD_OPTIONS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMood(mood === m.id ? '' : m.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${mood === m.id
                        ? 'bg-pink-500 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                  >
                    <span>{m.emoji}</span> {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tags */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">{t('lookTags')}</label>
              <div className="flex gap-2 flex-wrap mb-2">
                {tags.map(tTag => (
                  <span key={tTag} className="flex items-center gap-1 bg-pink-50 text-pink-600 px-2.5 py-1 rounded-full text-xs font-medium">
                    #{tTag}
                    <button onClick={() => removeTag(tTag)}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              {tags.length < 5 && (
                <div className="flex gap-2">
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder={t('addTagPlaceholder')}
                    className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                  />
                  <button
                    onClick={addTag}
                    className="bg-gray-100 px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-200 transition"
                  >
                    <Tag size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Public toggle */}
            <div className="mb-6">
              <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  {isPublic ? (
                    <Globe size={20} className="text-pink-500" />
                  ) : (
                    <Lock size={20} className="text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{isPublic ? t('isPublicLabel') : t('isPrivateLabel')}</p>
                    <p className="text-xs text-gray-400">
                      {isPublic ? t('publicDesc') : t('privateDesc')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPublic(!isPublic)}
                  className={`w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-pink-500' : 'bg-gray-200'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${isPublic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="mb-5">
              <label className="block text-xs font-semibold text-gray-500 mb-2">{t('preview')} ({selectedItems.length} {t('garmentCount')})</label>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {selectedItems.map(item => (
                  <div key={item.id} className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={() => setIsSaving(false)}
                className="flex-1 py-3.5 text-gray-500 font-medium rounded-xl bg-gray-100 hover:bg-gray-200 transition"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 bg-primary text-white py-3.5 rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition flex items-center justify-center gap-2"
              >
                <Save size={18} /> {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateLook;
