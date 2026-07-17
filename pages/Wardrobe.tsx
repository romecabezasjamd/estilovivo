
import React, { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
const CreateLook = lazy(() => import('./CreateLook'));
import { Garment, Look, PlannerEntry } from '../types';
import {
  Filter, Plus, Search, Trash2, X, Camera, Tag, DollarSign,
  Info, ExternalLink, RefreshCcw, Check, ShoppingBag as SellIcon, ShoppingBag, ChevronRight, Shirt, SlidersHorizontal, ArrowLeft, Sparkles, ImagePlus, Pencil
} from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';
import { dataUrlToFile, pickPhoto, CameraSource } from '../src/utils/cameraPhoto';
import ProductDetailModal, { ProductDisplayItem } from '../components/ProductDetailModal';
import ConfirmDialog from '../components/ConfirmDialog';

interface WardrobeProps {
  garments: Garment[];
  onAddGarment: (g: Garment, file?: File) => void;
  onRemoveGarment: (id: string) => void;
  onUpdateGarment: (g: Garment) => void;
  looks: Look[];
  onDeleteLook?: (id: string) => void;
  planner: PlannerEntry[];
  onUpdatePlanner: (e: PlannerEntry) => void;
  onNavigate: (tab: string, subTab?: string) => void;
  onSaveLook: (look: Look, onAfterSave?: () => void) => void;
  wardrobeIntent?: 'looks' | 'createLook' | null;
  onWardrobeIntentConsumed?: () => void;
  trips?: import('../types').Trip[];
  onUpdateTrip?: (trip: import('../types').Trip) => void;
}

type ViewType = 'closet' | 'looks' | 'sales';

const CATEGORIES = [
  { id: 'all', label: 'Todo' },
  { id: 'top', label: 'Tops' },
  { id: 'bottom', label: 'Bottoms' },
  { id: 'shoes', label: 'Zapatos' },
  { id: 'outerwear', label: 'Abrigos' },
  { id: 'accessories', label: 'Accesorios' },
  { id: 'dress', label: 'Vestidos' },
  { id: 'set', label: 'Conjuntos' },
  { id: 'swimwear', label: 'Traje de baño' },
  { id: 'activewear', label: 'Ropa deportiva' },
];

const SEASONS = [
  { id: 'all', label: 'Todo el año' },
  { id: 'summer', label: 'Verano' },
  { id: 'winter', label: 'Invierno' },
  { id: 'transition', label: 'Entretiempo' },
];

const Wardrobe: React.FC<WardrobeProps> = ({
  garments,
  onAddGarment,
  onRemoveGarment,
  onUpdateGarment,
  looks,
  onDeleteLook,
  planner,
  onUpdatePlanner,
  onNavigate,
  onSaveLook,
  wardrobeIntent,
  onWardrobeIntentConsumed,
  trips = [],
  onUpdateTrip,
}) => {
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState<ViewType>('closet');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteLookId, setConfirmDeleteLookId] = useState<string | null>(null);
  const [showCreateLook, setShowCreateLook] = useState(false);
  const [editingLook, setEditingLook] = useState<Look | null>(null);

  useEffect(() => {
    if (!wardrobeIntent) return;
    if (wardrobeIntent === 'looks') {
      setActiveView('looks');
      onWardrobeIntentConsumed?.();
    }
    if (wardrobeIntent === 'createLook') {
      setActiveView('looks');
      setShowCreateLook(true);
      onWardrobeIntentConsumed?.();
    }
  }, [wardrobeIntent, onWardrobeIntentConsumed]);

  const openCreateLook = () => {
    setEditingLook(null);
    setActiveView('looks');
    setShowCreateLook(true);
  };
  const [filter, setFilter] = useState('all');

  // Search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Filter panel
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [seasonFilter, setSeasonFilter] = useState('all');
  const [colorFilter, setColorFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'recent' | 'most-used' | 'least-used'>('recent');

  // Drag & Drop for Washing Machine
  const [isHoveringWashing, setIsHoveringWashing] = useState(false);
  const [isHoveringCloset, setIsHoveringCloset] = useState(false);

  // Add Modal
  const [isAdding, setIsAdding] = useState(false);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('top');
  const [newColor, setNewColor] = useState('');
  const [newSeason, setNewSeason] = useState<'all' | 'summer' | 'winter' | 'transition'>('all');
  const [newBrand, setNewBrand] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [addPhotoError, setAddPhotoError] = useState<string | null>(null);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);

  const applyPickedPhoto = (dataUrl: string, file: File) => {
    setNewImage(dataUrl);
    setNewFile(file);
    setAddPhotoError(null);
  };

  const pickGarmentPhoto = async (source: CameraSource) => {
    setIsPickingPhoto(true);
    setAddPhotoError(null);
    try {
      const { dataUrl, file } = await pickPhoto(source);
      applyPickedPhoto(dataUrl, file);
    } catch (err: any) {
      const rawMessage = String(err?.message || err || '');
      const message = rawMessage.toLowerCase();
      if (message.includes('cancel') || message.includes('cancelado')) return;
      console.warn('Photo pick failed:', err);
      setAddPhotoError(rawMessage || 'No se pudo obtener la foto. Revisa los permisos de cámara y galería e inténtalo de nuevo.');
    } finally {
      setIsPickingPhoto(false);
    }
  };

  // Sell Flow
  const [isSelling, setIsSelling] = useState(false);
  const [selectedForSale, setSelectedForSale] = useState<Garment | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [saleDescription, setSaleDescription] = useState('');
  const [saleCondition, setSaleCondition] = useState('good');
  const [saleSize, setSaleSize] = useState('');
  const [saleImage, setSaleImage] = useState<string | null>(null);
  const [saleFile, setSaleFile] = useState<File | null>(null);
  const [saleName, setSaleName] = useState('');
  const [saleCategory, setSaleCategory] = useState('top');
  const [saleUploadError, setSaleUploadError] = useState<string | null>(null);
  const [isPickingSalePhoto, setIsPickingSalePhoto] = useState(false);
  const saleFileInputRef = useRef<HTMLInputElement | null>(null);

  // Edit Flow
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editSize, setEditSize] = useState('');
  const [editCondition, setEditCondition] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editForSale, setEditForSale] = useState(false);

  // Detail Modal
  const [detailItem, setDetailItem] = useState<ProductDisplayItem | null>(null);
  const [selectedGarmentForDetail, setSelectedGarmentForDetail] = useState<Garment | null>(null);
  const [addToTripModalGarment, setAddToTripModalGarment] = useState<Garment | null>(null);

  // Filtered & searched items
  const filteredItems = useMemo(() => {
    let items = [...garments];

    // Category filter
    if (filter !== 'all') items = items.filter(g => g.type === filter);

    // Season filter
    if (seasonFilter !== 'all') items = items.filter(g => g.season === seasonFilter);

    // Color filter
    if (colorFilter !== 'all') items = items.filter(g => (g.color || '').toLowerCase() === colorFilter);

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(g =>
        (g.name || '').toLowerCase().includes(q) ||
        g.type.toLowerCase().includes(q) ||
        g.color.toLowerCase().includes(q) ||
        (g.brand || '').toLowerCase().includes(q)
      );
    }

    // Sort
    if (sortBy === 'most-used') items.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    else if (sortBy === 'least-used') items.sort((a, b) => (a.usageCount || 0) - (b.usageCount || 0));

    return items;
  }, [garments, filter, seasonFilter, colorFilter, searchQuery, sortBy]);

  const washingItems = useMemo(() => garments.filter(g => g.isWashing), [garments]);
  const closetItems = useMemo(() => filteredItems.filter(g => !g.isWashing), [filteredItems]);

  const availableColors = useMemo(() => {
    const colors = new Set<string>();
    garments.forEach(g => {
      if (g.color) colors.add(g.color.toLowerCase());
    });
    return ['all', ...Array.from(colors).sort()];
  }, [garments]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: garments.length };
    garments.forEach(g => {
      const t = (g.type || '').toLowerCase();
      if (/top|camis|blusa|shirt|polo|sweater|jersey/.test(t)) counts.top = (counts.top || 0) + 1;
      else if (/bottom|pantal|falda|short|jean|trouser/.test(t)) counts.bottom = (counts.bottom || 0) + 1;
      else if (/shoe|zapat|bota|sandal|boot/.test(t)) counts.shoes = (counts.shoes || 0) + 1;
      else if (/outer|chaqueta|abrigo|saco|jacket|coat/.test(t)) counts.outerwear = (counts.outerwear || 0) + 1;
      else if (/accesorio|sombrero|gorra|bolso|gafas|collar/.test(t)) counts.accessories = (counts.accessories || 0) + 1;
      else if (/dress|vestido|enterizo/.test(t)) counts.dress = (counts.dress || 0) + 1;
      else if (/conjunto|set/.test(t)) counts.set = (counts.set || 0) + 1;
      else if (/baño|swim/.test(t)) counts.swimwear = (counts.swimwear || 0) + 1;
      else if (/deport|sport|activ/.test(t)) counts.activewear = (counts.activewear || 0) + 1;
    });
    return counts;
  }, [garments]);

  const topUsedItems = useMemo(
    () => [...garments].sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)).slice(0, 5),
    [garments]
  );

  const lowUsageItems = useMemo(
    () => garments.filter(g => (g.usageCount || 0) < 2).slice(0, 5),
    [garments]
  );

  // Sales items
  const salesItems = garments.filter(g => g.forSale);
  const totalSalesValue = salesItems.reduce((acc, curr) => acc + (curr.price || 0), 0);

  // Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setNewImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const confirmAdd = () => {
    if (!newImage || !newName.trim()) return;
    let fileToUpload = newFile;
    if (!fileToUpload && newImage.startsWith('data:')) {
      fileToUpload = dataUrlToFile(newImage, `garment-${Date.now()}.jpg`);
    }
    const garment: Garment = {
      id: `g-${Date.now()}`,
      imageUrl: newImage,
      name: newName.trim(),
      type: newCategory,
      color: newColor || 'sin color',
      season: newSeason,
      usageCount: 0,
      forSale: false,
      brand: newBrand || undefined,
    };
    onAddGarment(garment, fileToUpload);
    resetAddModal();
  };

  const resetAddModal = () => {
    setIsAdding(false);
    setNewImage(null);
    setNewFile(null);
    setAddPhotoError(null);
    setNewName('');
    setNewCategory('top');
    setNewColor('');
    setNewSeason('all');
    setNewBrand('');
  };

  const validateImage = (file: File): string | null => {
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) return 'La imagen es demasiado grande. El tamaño máximo es 10MB.';
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) return 'Formato no válido. Usa JPEG, PNG o WebP.';
    return null;
  };

  const applySalePhoto = (dataUrl: string, file: File) => {
    setSaleImage(dataUrl);
    setSaleFile(file);
    setSaleUploadError(null);
  };

  const pickSalePhoto = async (source: CameraSource) => {
    setIsPickingSalePhoto(true);
    setSaleUploadError(null);
    try {
      const { dataUrl, file } = await pickPhoto(source);
      const error = validateImage(file);
      if (error) {
        setSaleUploadError(error);
        return;
      }
      applySalePhoto(dataUrl, file);
    } catch (err: any) {
      const rawMessage = String(err?.message || err || '');
      const message = rawMessage.toLowerCase();
      if (message.includes('cancel') || message.includes('cancelado')) return;
      console.warn('Sale photo pick failed:', err);
      setSaleUploadError(rawMessage || 'No se pudo obtener la foto. Revisa los permisos de cámara y galería e inténtalo de nuevo.');
    } finally {
      setIsPickingSalePhoto(false);
    }
  };

  const handleSaleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateImage(file);
    if (error) {
      setSaleUploadError(error);
      return;
    }
    setSaleFile(file);
    setSaleUploadError(null);
    const reader = new FileReader();
    reader.onloadend = () => setSaleImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const resetEditModal = () => {
    setIsEditing(false);
    setEditName('');
    setEditCategory('');
    setEditColor('');
    setEditBrand('');
    setEditSize('');
    setEditCondition('');
    setEditDescription('');
    setEditPrice('');
    setEditForSale(false);
  };

  const openEditModal = (item: Garment) => {
    setEditName(item.name || '');
    setEditCategory(item.type || 'top');
    setEditColor(item.color || '');
    setEditBrand(item.brand || '');
    setEditSize(item.size || '');
    setEditCondition(item.condition || 'good');
    setEditDescription(item.description || '');
    setEditPrice(item.price ? String(item.price) : '');
    setEditForSale(item.forSale || false);
    setIsEditing(true);
  };

  const confirmEdit = () => {
    if (!selectedGarmentForDetail) return;
    onUpdateGarment({
      ...selectedGarmentForDetail,
      name: editName,
      type: editCategory,
      color: editColor,
      brand: editBrand || undefined,
      size: editSize || undefined,
      condition: editCondition || undefined,
      description: editDescription || undefined,
      price: editPrice ? parseFloat(editPrice) : undefined,
      forSale: editForSale,
    });
    resetEditModal();
    setDetailItem(null);
  };

  const resetSellModal = () => {
    setIsSelling(false);
    setSelectedForSale(null);
    setSalePrice('');
    setSaleDescription('');
    setSaleCondition('bueno');
    setSaleSize('');
    setSaleImage(null);
    setSaleFile(null);
    setSaleName('');
    setSaleCategory('top');
    setSaleUploadError(null);
  };

  const confirmNewSale = () => {
    if (!saleImage || !saleName.trim() || !salePrice) return;
    let fileToUpload = saleFile;
    if (!fileToUpload && saleImage.startsWith('data:')) {
      fileToUpload = dataUrlToFile(saleImage, `garment-sale-${Date.now()}.jpg`);
    }
    const garment: Garment = {
      id: `g-${Date.now()}`,
      imageUrl: saleImage,
      name: saleName.trim(),
      type: saleCategory,
      color: 'sin color',
      season: 'all',
      usageCount: 0,
      forSale: true,
      price: parseFloat(salePrice),
      description: saleDescription || undefined,
      condition: saleCondition,
      size: saleSize || undefined,
    };
    onAddGarment(garment, fileToUpload);
    resetSellModal();
    setActiveView('sales');
  };

  const confirmSale = () => {
    if (!salePrice) return;
    if (selectedForSale) {
      onUpdateGarment({
        ...selectedForSale,
        forSale: true,
        price: parseFloat(salePrice),
        description: saleDescription || undefined,
        condition: saleCondition,
        size: saleSize || undefined,
      });
      resetSellModal();
      setActiveView('sales');
    } else {
      confirmNewSale();
    }
  };

  const cancelSale = (item: Garment) => {
    onUpdateGarment({
      ...item,
      forSale: false,
      price: null,
    });
  };

  const openDetailModal = (item: Garment) => {
    setSelectedGarmentForDetail(item);
    setDetailItem({
      id: item.id,
      title: item.name || item.type,
      price: item.price || 0,
      image: item.imageUrl,
      user: "Tú",
      avatar: "",
      description: item.description || `${item.type} - ${item.color}`,
      isOwnItem: true,
    });
  };

  const getLookImage = (look: Look) => {
    if (look.imageUrl) return look.imageUrl;
    if (look.garments && look.garments.length > 0) return look.garments[0].imageUrl;
    return null;
  };

  const onDragStart = (e: React.DragEvent, garmentId: string) => {
    e.dataTransfer.setData('garmentId', garmentId);
    window.dispatchEvent(new CustomEvent('dragStartGarment'));
  };

  const onDragEnd = () => {
    window.dispatchEvent(new CustomEvent('dragEndGarment'));
  };

  const onDropWashingMachine = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveringWashing(false);
    const garmentId = e.dataTransfer.getData('garmentId');
    const garment = garments.find(g => g.id === garmentId);
    if (garment && !garment.isWashing && !garment.forSale) {
      onUpdateGarment({ ...garment, isWashing: true });
    }
  };

  const onDropCloset = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveringCloset(false);
    const garmentId = e.dataTransfer.getData('garmentId');
    const garment = garments.find(g => g.id === garmentId);
    if (garment && garment.isWashing) {
      onUpdateGarment({ ...garment, isWashing: false });
    }
  };

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchQuery('');
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  };

  return (
    <div className="h-full flex flex-col relative bg-gray-50">
      {/* Top Section */}
      <div className="bg-[var(--bg-card)] pb-3 pt-6 sticky top-0 z-20 shadow-sm rounded-b-3xl mb-4">
        <div className="px-6 mb-3">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">{t('wardrobe')}</h1>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-gray-50 rounded-full px-4 py-2">
              <Search size={16} className="text-[var(--text-muted)] mr-2 shrink-0" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar prenda, color, marca..."
                className="flex-1 bg-transparent text-sm outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X size={16} className="text-[var(--text-muted)]" />
                </button>
              )}
            </div>
            <button
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className={`p-2.5 rounded-full border transition ${filterPanelOpen || seasonFilter !== 'all' || sortBy !== 'recent'
                ? 'bg-primary/10 border-primary/20 text-primary'
                : 'bg-gray-50 border-[var(--border-light)] text-[var(--text-secondary)] hover:bg-gray-100'
                }`}
            >
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </div>
        {activeView === 'closet' && (
          <div className="px-6 mb-2">
            <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {availableColors.slice(0, 8).map(c => (
                <button
                  key={c}
                  onClick={() => setColorFilter(c)}
                  className={`px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap transition ${colorFilter === c ? 'bg-primary text-white' : 'bg-gray-100 text-[var(--text-secondary)]'
                    }`}
                >
                  {c === 'all' ? 'Todos' : c}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pill Selector */}
        <div className="px-6">
          <div className="bg-gray-100 p-1.5 rounded-2xl flex font-medium text-sm">
            {(['closet', 'looks', 'sales'] as ViewType[]).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`flex-1 py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-1 ${activeView === view
                  ? 'bg-[var(--bg-card)] text-primary shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
              >
                {view === 'closet' && <><Shirt size={14} /> Armario</>}
                {view === 'looks' && <><Sparkles size={14} /> Looks</>}
                {view === 'sales' && <><ShoppingBag size={14} /> Ventas</>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Panel */}
      {filterPanelOpen && activeView === 'closet' && (
        <div className="mx-6 mb-4 bg-[var(--bg-card)] rounded-2xl p-4 shadow-sm border border-[var(--border-light)] animate-fade-in">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold">Filtros avanzados</h3>
            <button
              onClick={() => { setSeasonFilter('all'); setColorFilter('all'); setSortBy('recent'); setFilterPanelOpen(false); }}
              className="text-xs text-primary font-medium"
            >
              Limpiar
            </button>
          </div>
          <div className="mb-3">
            <p className="text-xs text-[var(--text-muted)] mb-2">Temporada</p>
            <div className="flex gap-2 flex-wrap">
              {SEASONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSeasonFilter(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${seasonFilter === s.id ? 'bg-primary text-white' : 'bg-gray-100 text-[var(--text-secondary)]'
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-2">Ordenar por</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'recent' as const, label: 'Recientes' },
                { id: 'most-used' as const, label: 'Más usados' },
                { id: 'least-used' as const, label: 'Menos usados' },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${sortBy === s.id ? 'bg-primary text-white' : 'bg-gray-100 text-[var(--text-secondary)]'
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs text-[var(--text-muted)] mb-2">Color</p>
            <div className="flex gap-2 flex-wrap">
              {availableColors.map(c => (
                <button
                  key={c}
                  onClick={() => setColorFilter(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${colorFilter === c ? 'bg-primary text-white' : 'bg-gray-100 text-[var(--text-secondary)]'
                    }`}
                >
                  {c === 'all' ? 'Todos' : c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: CLOSET */}
      {activeView === 'closet' && (
        <div className="px-6 flex-1 overflow-y-auto no-scrollbar pb-24">
          {/* Category pills with counts */}
          <div className="flex space-x-2 overflow-x-auto no-scrollbar mb-4 pb-2">
            {CATEGORIES.map((cat) => {
              const count = categoryCounts[cat.id] || 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setFilter(cat.id)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors border flex items-center gap-1.5 ${filter === cat.id
                    ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-light)]'
                    }`}
                >
                  {cat.label}
                  {count > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${filter === cat.id ? 'bg-white/20' : 'bg-gray-100'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Removed inline Washing Machine - moved to Layout nav bubbles */}

          {/* Count & sort info */}
          <div className="flex justify-between items-center px-1 mb-4 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <span>{filteredItems.length} Prendas</span>
            <span>
              {sortBy === 'recent' && 'Orden: Recientes'}
              {sortBy === 'most-used' && 'Orden: Más usados'}
              {sortBy === 'least-used' && 'Orden: Menos usados'}
            </span>
          </div>

          {/* Empty state */}
          {filteredItems.length === 0 && (
            <div className="text-center py-16 px-8">
              <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Shirt size={32} className="text-gray-300" />
              </div>
              {searchQuery ? (
                <>
                  <p className="text-[var(--text-primary)] font-medium mb-1">Sin resultados</p>
                  <p className="text-xs text-[var(--text-muted)] mb-4">No encontramos prendas para "{searchQuery}"</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="px-4 py-2 rounded-full text-xs font-medium bg-primary text-white"
                  >
                    Limpiar búsqueda
                  </button>
                </>
              ) : filter !== 'all' ? (
                <>
                  <p className="text-[var(--text-primary)] font-medium mb-1">Sin prendas en esta categoría</p>
                  <p className="text-xs text-[var(--text-muted)] mb-4">Añade prendas de tipo "{CATEGORIES.find(c => c.id === filter)?.label}" o prueba otro filtro</p>
                  <button
                    onClick={() => setFilter('all')}
                    className="px-4 py-2 rounded-full text-xs font-medium bg-primary text-white"
                  >
                    Ver todas
                  </button>
                </>
              ) : (
                <>
                  <p className="text-[var(--text-primary)] font-medium mb-1">Tu armario está vacío</p>
                  <p className="text-xs text-[var(--text-muted)] mb-4">Añade tu primera prenda para empezar a crear outfits</p>
                  <button
                    onClick={() => setIsAdding(true)}
                    className="px-4 py-2 rounded-full text-xs font-medium bg-primary text-white inline-flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Añadir prenda
                  </button>
                </>
              )}
            </div>
          )}

          {/* Garments Grid */}
          <div
            className={`grid grid-cols-2 gap-4 transition-all duration-300 ${isHoveringCloset ? 'bg-emerald-50/50 p-2 -m-2 rounded-2xl ring-2 ring-emerald-200 border-dashed' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsHoveringCloset(true); }}
            onDragLeave={() => setIsHoveringCloset(false)}
            onDrop={onDropCloset}
          >
            {closetItems.map((garment) => (
              <div
                key={garment.id}
                draggable={!garment.forSale}
                onDragStart={(e) => onDragStart(e, garment.id)}
                onDragEnd={onDragEnd}
                onClick={() => openDetailModal(garment)}
                className={`group stagger-child relative bg-[var(--bg-card)] rounded-2xl overflow-hidden shadow-sm border border-[var(--border-light)] hover:shadow-md hover:border-primary/50 transition-all ${!garment.forSale ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
              >
                <div className="aspect-[3/4] overflow-hidden bg-gray-50 relative">
                  <img
                    src={garment.imageUrl}
                    alt={garment.name || garment.type}
                    className={`w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500 ${garment.forSale ? 'opacity-70 grayscale-[0.5]' : ''}`}
                  />
                  {!garment.forSale && (
                    <div className="absolute top-2 w-full px-2 flex justify-between">
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(garment.id); }}
                        className="bg-[var(--bg-card)]/90 backdrop-blur-sm p-1.5 rounded-full text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedForSale(garment);
                          setIsSelling(true);
                        }}
                        className="bg-[var(--bg-card)]/90 backdrop-blur-sm p-1.5 rounded-full text-emerald-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm"
                        title="Vender prenda"
                      >
                        <ShoppingBag size={14} />
                      </button>
                    </div>
                  )}
                  {garment.forSale && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">
                        En venta · {garment.price}€
                      </span>
                    </div>
                  )}
                </div>

                {!garment.forSale && (
                  <div className="absolute bottom-14 right-2 bg-[var(--bg-card)]/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-bold text-primary shadow-sm">
                    {garment.usageCount || 0} usos
                  </div>
                )}

                <div className="p-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{garment.name || garment.type}</p>
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)] capitalize mt-0.5">
                    <span>{garment.color}</span>
                    {garment.brand && <span className="text-[10px]">{garment.brand}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* FAB - above bottom nav (z-50) */}
          <button
            onClick={() => setIsAdding(true)}
            className="fixed bottom-28 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg shadow-primary/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-all duration-200 z-[60] animate-pulse-soft"
          >
            <Plus size={28} />
          </button>
        </div>
      )}

      {/* VIEW: LOOKS */}
      {activeView === 'looks' && (
        <div className="px-6 flex-1 overflow-y-auto no-scrollbar pb-24 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[var(--text-primary)]">Tus Looks</h3>
            <button
              type="button"
              onClick={openCreateLook}
              className="text-primary text-xs font-bold bg-primary/10 px-3 py-1.5 rounded-full"
            >
              + Crear Look
            </button>
          </div>

          {looks.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles size={48} className="mx-auto text-gray-200 mb-3" />
              <p className="text-[var(--text-muted)] text-sm">Aún no tienes looks guardados</p>
              <p className="text-xs text-gray-300 mt-1">Crea tu primer look en minutos</p>
              <button
                type="button"
                onClick={openCreateLook}
                className="mt-4 text-primary text-sm font-medium"
              >
                Crear Look
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {looks.map((look) => {
                const lookImg = getLookImage(look);
                return (
                  <div
                    key={look.id}
                    className="bg-[var(--bg-card)] rounded-2xl overflow-hidden shadow-sm border border-[var(--border-light)] hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-[4/5] bg-gray-50 relative">
                      {lookImg ? (
                        <img src={lookImg} alt={look.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Sparkles size={28} />
                        </div>
                      )}
                      {onDeleteLook && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteLookId(look.id); }}
                          className="absolute top-2 left-2 p-1.5 rounded-full bg-black/40 text-white hover:bg-red-500/80 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setEditingLook(look); setShowCreateLook(true); }}
                        className="absolute top-2 left-10 p-1.5 rounded-full bg-black/40 text-white hover:bg-primary/80 transition-colors"
                      >
                        <Pencil size={12} />
                      </button>
                      {look.isPublic && (
                        <div className="absolute top-2 right-2 bg-[var(--bg-card)]/90 backdrop-blur-sm text-[10px] font-bold text-primary px-2 py-1 rounded-full">
                          Publico
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{look.name}</p>
                      <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mt-0.5">
                        <span>{look.garments?.filter(g => !!g).length || 0} prendas</span>
                        <span className="capitalize">{look.mood || 'personal'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: SALES */}
      {activeView === 'sales' && (
        <div className="px-6 flex-1 overflow-y-auto no-scrollbar pb-24 animate-fade-in">
          {/* Sales summary card */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-4 text-white mb-6 shadow-lg shadow-emerald-900/10">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-emerald-100 text-xs font-medium mb-1">Valor en escaparate</p>
                <h3 className="text-3xl font-bold">{totalSalesValue.toFixed(0)}€</h3>
              </div>
              <div className="bg-[var(--bg-card)]/20 p-2 rounded-xl">
                <DollarSign size={20} className="text-white" />
              </div>
            </div>
            <div className="mt-4 flex space-x-3 text-xs font-medium">
              <span className="bg-[var(--bg-card)]/20 px-2 py-1 rounded-lg">{salesItems.length} en venta</span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-[var(--text-primary)]">En tu escaparate</h3>
            <button
              onClick={() => { setIsSelling(true); setSelectedForSale(null); setSalePrice(''); setSaleName(''); setSaleImage(null); setSaleFile(null); setSaleUploadError(null); setSaleCategory('top'); }}
              className="text-primary text-xs font-bold bg-primary/10 px-3 py-1.5 rounded-full"
            >
              + Nueva Venta
            </button>
          </div>

          {salesItems.length === 0 ? (
            <div className="text-center py-16 px-8">
              <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <ShoppingBag size={32} className="text-gray-300" />
              </div>
              <p className="text-[var(--text-primary)] font-medium mb-1">Ventas próximamente</p>
              <p className="text-xs text-[var(--text-muted)] mb-4">Estamos trabajando con nuevas marcas para que puedas vender y comprar prendas directamente desde la app</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 text-[10px] font-medium text-[var(--text-muted)]">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                Próximamente
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {salesItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-[var(--bg-card)] rounded-2xl overflow-hidden shadow-sm border border-[var(--border-light)] relative"
                >
                  <div className="absolute top-2 right-2 z-10 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                    {item.price}€
                  </div>
                  <div
                    className="aspect-square bg-gray-50 cursor-pointer"
                    onClick={() => openDetailModal(item)}
                  >
                    <img src={item.imageUrl} alt="" className="w-full h-full object-cover opacity-90" />
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{item.name || item.type}</p>
                    {item.condition && (
                      <p className="text-[10px] text-[var(--text-muted)] capitalize mt-0.5">{item.condition}</p>
                    )}
                    <button
                      onClick={() => cancelSale(item)}
                      className="mt-2 text-[10px] text-red-400 font-medium underline"
                    >
                      Retirar de venta
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ADD GARMENT MODAL */}
      {isAdding && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-card)] w-full max-w-md rounded-3xl shadow-2xl animate-pop-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 p-6 border-b border-[var(--border-light)] flex-shrink-0">
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Nueva Prenda</h2>
              <button onClick={resetAddModal}>
                <X size={24} className="text-[var(--text-muted)]" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 space-y-4">
              {/* Image Upload */}
              <div>
                {!newImage ? (
                  <div className="w-full aspect-[4/3] bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center p-4 gap-3">
                    <Camera size={36} className="text-gray-300" />
                    <span className="text-sm text-[var(--text-secondary)] font-medium">Añade una foto de la prenda</span>
                    <div className="flex gap-2 w-full max-w-xs">
                      <button
                        type="button"
                        disabled={isPickingPhoto}
                        onClick={() => pickGarmentPhoto(CameraSource.Camera)}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50 hover:opacity-80 transition-opacity"
                      >
                        Cámara
                      </button>
                      <button
                        type="button"
                        disabled={isPickingPhoto}
                        onClick={() => pickGarmentPhoto(CameraSource.Photos)}
                        className="flex-1 py-2.5 rounded-xl bg-gray-800 text-white text-xs font-bold disabled:opacity-50 hover:opacity-80 transition-opacity"
                      >
                        Galería
                      </button>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-[var(--text-muted)] cursor-pointer hover:text-primary transition-colors">
                      <ImagePlus size={14} />
                      <span>O subir desde el dispositivo</span>
                      <input ref={el => { fileInputRef.current = el; }} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                    {addPhotoError && (
                      <p className="text-xs text-red-500 font-medium text-center">{addPhotoError}</p>
                    )}
                  </div>
                ) : (
                  <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
                    <img src={newImage} className="w-full h-full object-cover" />
                    <button
                      onClick={() => { setNewImage(null); setNewFile(null); }}
                      className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Nombre</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ej: Camiseta rayas azul"
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Categoría</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setNewCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${newCategory === cat.id ? 'bg-primary text-white' : 'bg-gray-100 text-[var(--text-secondary)]'
                        }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color & Brand */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Color</label>
                  <input
                    value={newColor}
                    onChange={e => setNewColor(e.target.value)}
                    placeholder="Ej: azul"
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Marca</label>
                  <input
                    value={newBrand}
                    onChange={e => setNewBrand(e.target.value)}
                    placeholder="Opcional"
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>

              {/* Season */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Temporada</label>
                <div className="flex gap-2 flex-wrap">
                  {SEASONS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setNewSeason(s.id as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${newSeason === s.id ? 'bg-primary text-white' : 'bg-gray-100 text-[var(--text-secondary)]'
                        }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 pt-4 flex-shrink-0">
              <button
                disabled={!newImage || !newName.trim()}
                onClick={confirmAdd}
                className="w-full bg-primary disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl transition-colors"
              >
                Añadir al Armario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELL MODAL */}
      {isSelling && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-card)] w-full max-w-sm rounded-3xl shadow-2xl animate-pop-in flex flex-col max-h-[90vh]">
            <div className="flex-shrink-0 p-6 border-b border-gray-50 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <SellIcon size={32} />
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Poner en venta</h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">Convierte tu armario en ingresos</p>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {selectedForSale ? (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                  <img src={selectedForSale.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="" />
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{selectedForSale.name || selectedForSale.type}</p>
                    <p className="text-[10px] text-[var(--text-muted)] capitalize">{selectedForSale.color} · {selectedForSale.brand || 'Marca no especif.'}</p>
                  </div>
                </div>
              ) : (
                <div>
                  {!saleImage ? (
                    <div className="w-full aspect-[4/3] bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center p-4 gap-3">
                      <Camera size={36} className="text-gray-300" />
                      <span className="text-sm text-[var(--text-secondary)] font-medium">Foto de la prenda</span>
                      <div className="flex gap-2 w-full max-w-xs">
                        <button
                          type="button"
                          disabled={isPickingSalePhoto}
                          onClick={() => pickSalePhoto(CameraSource.Camera)}
                          className="flex-1 py-2.5 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-50 hover:opacity-80 transition-opacity"
                        >
                          Cámara
                        </button>
                        <button
                          type="button"
                          disabled={isPickingSalePhoto}
                          onClick={() => pickSalePhoto(CameraSource.Photos)}
                          className="flex-1 py-2.5 rounded-xl bg-gray-800 text-white text-xs font-bold disabled:opacity-50 hover:opacity-80 transition-opacity"
                        >
                          Galería
                        </button>
                      </div>
                      <label className="flex items-center gap-1 text-xs text-[var(--text-muted)] cursor-pointer hover:text-primary transition-colors">
                        <ImagePlus size={14} />
                        <span>O subir desde el dispositivo</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleSaleFileUpload} />
                      </label>
                      {saleUploadError && (
                        <p className="text-xs text-red-500 font-medium text-center">{saleUploadError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
                      <img src={saleImage} className="w-full h-full object-cover" />
                      <button
                        onClick={() => { setSaleImage(null); setSaleFile(null); setSaleUploadError(null); }}
                        className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {!selectedForSale && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Nombre</label>
                    <input
                      value={saleName}
                      onChange={e => setSaleName(e.target.value)}
                      placeholder="Ej: Vestido floral verano"
                      className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Categoría</label>
                    <div className="flex gap-2 flex-wrap">
                      {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => setSaleCategory(cat.id)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${saleCategory === cat.id ? 'bg-primary text-white' : 'bg-gray-100 text-[var(--text-secondary)]'}`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5 ml-1">Precio de venta</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-bold">€</span>
                  <input
                    type="number"
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-50 rounded-xl py-3 pl-8 pr-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5 ml-1">Estado</label>
                  <select
                    value={saleCondition}
                    onChange={e => setSaleCondition(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium outline-none appearance-none"
                  >
                    <option value="new">Nuevo</option>
                    <option value="fair">Como nuevo</option>
                    <option value="good">Buen estado</option>
                    <option value="worn">Usado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5 ml-1">Talla</label>
                  <input
                    value={saleSize}
                    onChange={e => setSaleSize(e.target.value)}
                    placeholder="M, 42, etc"
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mb-1.5 ml-1">Descripción</label>
                <textarea
                  value={saleDescription}
                  onChange={e => setSaleDescription(e.target.value)}
                  placeholder="Describe el estado, estilo, historial de uso..."
                  rows={3}
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                />
              </div>
            </div>

            <div className="flex-shrink-0 p-6 bg-gray-50 flex gap-3">
              <button
                onClick={() => resetSellModal()}
                className="flex-1 py-3 text-sm font-bold text-[var(--text-muted)]"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSale}
                className="flex-[2] bg-emerald-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors"
                disabled={!salePrice || (!selectedForSale && (!saleImage || !saleName.trim()))}
              >
                Publicar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditing && selectedGarmentForDetail && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-card)] w-full max-w-sm rounded-3xl shadow-2xl animate-pop-in flex flex-col max-h-[90vh]">
            <div className="flex-shrink-0 p-6 border-b border-gray-50 text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </div>
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Editar prenda</h2>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                <img src={selectedGarmentForDetail.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--text-primary)] truncate">{selectedGarmentForDetail.name || selectedGarmentForDetail.type}</p>
                  <p className="text-[10px] text-[var(--text-muted)] capitalize">{selectedGarmentForDetail.color}</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Nombre</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Categoría</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <button key={cat.id} onClick={() => setEditCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${editCategory === cat.id ? 'bg-primary text-white' : 'bg-gray-100 text-[var(--text-secondary)]'}`}>{cat.label}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Color</label>
                  <input value={editColor} onChange={e => setEditColor(e.target.value)} placeholder="Ej: rojo" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Marca</label>
                  <input value={editBrand} onChange={e => setEditBrand(e.target.value)} placeholder="Ej: Zara" className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Talla</label>
                  <input value={editSize} onChange={e => setEditSize(e.target.value)} placeholder="M, 42..." className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Estado</label>
                  <select value={editCondition} onChange={e => setEditCondition(e.target.value)} className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none appearance-none">
                    <option value="new">Nuevo</option>
                    <option value="good">Buen estado</option>
                    <option value="fair">Como nuevo</option>
                    <option value="worn">Usado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Descripción</label>
                <textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={2} className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none resize-none" />
              </div>
              {editForSale && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">Precio (€)</label>
                  <input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none" />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={editForSale} onChange={e => setEditForSale(e.target.checked)} className="rounded" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">En venta</span>
              </label>
            </div>
            <div className="flex-shrink-0 p-6 bg-gray-50 flex gap-3">
              <button onClick={resetEditModal} className="flex-1 py-3 text-sm font-bold text-[var(--text-muted)]">Cancelar</button>
              <button onClick={confirmEdit} className="flex-[2] bg-blue-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-colors">Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {detailItem && (
        <ProductDetailModal
          product={detailItem}
          onClose={() => setDetailItem(null)}
          onAddToTrip={() => {
            if (selectedGarmentForDetail) {
              setAddToTripModalGarment(selectedGarmentForDetail);
            }
          }}
          onAddToWashing={() => {
            if (selectedGarmentForDetail) {
              onUpdateGarment({ ...selectedGarmentForDetail, isWashing: true });
              window.dispatchEvent(new CustomEvent('animateLavadora'));
            }
          }}
          onSell={() => {
            if (selectedGarmentForDetail) {
              setSelectedForSale(selectedGarmentForDetail);
              setIsSelling(true);
            }
          }}
          onEdit={() => {
            if (selectedGarmentForDetail) {
              openEditModal(selectedGarmentForDetail);
            }
          }}
          onDelete={() => {
            if (selectedGarmentForDetail) {
              setConfirmDeleteId(selectedGarmentForDetail.id);
            }
          }}
        />
      )}

      {/* SELECT TRIP MODAL */}
      {addToTripModalGarment && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[var(--bg-card)] w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-pop-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-[var(--text-primary)]">Añadir a un viaje</h3>
              <button
                onClick={() => setAddToTripModalGarment(null)}
                className="p-2 -mr-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-[var(--text-secondary)]" />
              </button>
            </div>
            
            {trips.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-[var(--text-secondary)] mb-4">No tienes viajes planificados.</p>
                <button 
                  onClick={() => { setAddToTripModalGarment(null); onNavigate('suitcase'); }}
                  className="bg-primary text-white text-sm font-bold px-4 py-2 rounded-xl"
                >
                  Crear un Viaje
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar pb-2">
                {trips.map(trip => {
                  const isIncluded = trip.garments?.some(g => g && g.id === addToTripModalGarment.id);
                  return (
                    <button
                      key={trip.id}
                      onClick={() => {
                        if (onUpdateTrip && !isIncluded) {
                          onUpdateTrip({ ...trip, garments: [...(trip.garments || []), addToTripModalGarment] });
                          setAddToTripModalGarment(null);
                        }
                      }}
                      className={`w-full text-left flex items-center justify-between p-4 rounded-2xl border transition-all ${isIncluded ? 'border-primary bg-primary/5 opacity-50 cursor-default' : 'border-[var(--border-light)] bg-[var(--bg-card)] hover:border-primary/50'}`}
                    >
                      <div>
                        <p className="font-bold text-[var(--text-primary)]">{trip.destination}</p>
                        <p className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] mt-1">{trip.dateStart}</p>
                      </div>
                      {isIncluded ? <Check size={20} className="text-primary" /> : <Plus size={20} className="text-[var(--text-muted)]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {showCreateLook && (
        <div className="fixed inset-0 z-[55] bg-[var(--bg-card)]">
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            }
          >
            <CreateLook
              garments={garments}
              onSaveLook={(look) => {
                onSaveLook(look, () => { setShowCreateLook(false); setEditingLook(null); });
              }}
              onClose={() => { setShowCreateLook(false); setEditingLook(null); }}
              editLook={editingLook || undefined}
            />
          </Suspense>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Eliminar prenda"
        message="¿Seguro que quieres eliminar esta prenda? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive={true}
        onConfirm={() => {
          if (confirmDeleteId) {
            onRemoveGarment(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        onCancel={() => setConfirmDeleteId(null)}
      />

      {/* Confirm Delete Look Dialog */}
      <ConfirmDialog
        open={!!confirmDeleteLookId}
        title="Eliminar look"
        message="¿Seguro que quieres eliminar este look? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive={true}
        onConfirm={() => {
          if (confirmDeleteLookId && onDeleteLook) {
            onDeleteLook(confirmDeleteLookId);
            setConfirmDeleteLookId(null);
          }
        }}
        onCancel={() => setConfirmDeleteLookId(null)}
      />
    </div>
  );
};

export default Wardrobe;
