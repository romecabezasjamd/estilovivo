
import React, { useState, useMemo, useRef } from 'react';
import { Garment, Look, PlannerEntry } from '../types';
import {
  Filter, Plus, Search, Trash2, X, Camera, Tag, DollarSign,
  Info, ExternalLink, RefreshCcw, Check, ShoppingBag as SellIcon, ShoppingBag, ChevronRight, Shirt, SlidersHorizontal, ArrowLeft, Sparkles
} from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';
import ProductDetailModal, { ProductDisplayItem } from '../components/ProductDetailModal';

interface WardrobeProps {
  garments: Garment[];
  onAddGarment: (g: Garment, file?: File) => void;
  onRemoveGarment: (id: string) => void;
  onUpdateGarment: (g: Garment) => void;
  looks: Look[];
  planner: PlannerEntry[];
  onUpdatePlanner: (e: PlannerEntry) => void;
  onNavigate: (tab: string) => void;
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
  planner,
  onUpdatePlanner,
  onNavigate,
}) => {
  const { t } = useLanguage();
  const [activeView, setActiveView] = useState<ViewType>('closet');
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

  // Add Modal
  const [isAdding, setIsAdding] = useState(false);
  const [newImage, setNewImage] = useState<string | null>(null);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('top');
  const [newColor, setNewColor] = useState('');
  const [newSeason, setNewSeason] = useState<'all' | 'summer' | 'winter' | 'transition'>('all');
  const [newBrand, setNewBrand] = useState('');

  // Sell Flow
  const [isSelling, setIsSelling] = useState(false);
  const [selectedForSale, setSelectedForSale] = useState<Garment | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [saleDescription, setSaleDescription] = useState('');
  const [saleCondition, setSaleCondition] = useState('bueno');
  const [saleSize, setSaleSize] = useState('');

  // Detail Modal
  const [detailItem, setDetailItem] = useState<ProductDisplayItem | null>(null);
  const [selectedGarmentForDetail, setSelectedGarmentForDetail] = useState<Garment | null>(null);

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

  const availableColors = useMemo(() => {
    const colors = new Set<string>();
    garments.forEach(g => {
      if (g.color) colors.add(g.color.toLowerCase());
    });
    return ['all', ...Array.from(colors).sort()];
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
    if (!newImage) return;
    const garment: Garment = {
      id: `g-${Date.now()}`,
      imageUrl: newImage,
      name: newName || newCategory,
      type: newCategory,
      color: newColor || 'sin color',
      season: newSeason,
      usageCount: 0,
      forSale: false,
      brand: newBrand || undefined,
    };
    onAddGarment(garment, newFile || undefined);
    resetAddModal();
  };

  const resetAddModal = () => {
    setIsAdding(false);
    setNewImage(null);
    setNewFile(null);
    setNewName('');
    setNewCategory('top');
    setNewColor('');
    setNewSeason('all');
    setNewBrand('');
  };

  const confirmSale = () => {
    if (selectedForSale && salePrice) {
      onUpdateGarment({
        ...selectedForSale,
        forSale: true,
        price: parseFloat(salePrice),
        description: saleDescription || undefined,
        condition: saleCondition,
        size: saleSize || undefined,
      });
      setIsSelling(false);
      setSelectedForSale(null);
      setSalePrice('');
      setSaleDescription('');
      setSaleCondition('bueno');
      setSaleSize('');
      setActiveView('sales');
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
      <div className="bg-white pb-2 pt-6 sticky top-0 z-20 shadow-sm rounded-b-3xl mb-4">
        <div className="flex justify-between items-center px-6 mb-4">
          {searchOpen ? (
            <div className="flex-1 flex items-center gap-2">
              <button onClick={toggleSearch}>
                <ArrowLeft size={20} className="text-gray-500" />
              </button>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar prenda, color, marca..."
                className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X size={18} className="text-gray-400" />
                </button>
              )}
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-800">{t('wardrobe')}</h1>
              {activeView === 'closet' && (
                <div className="flex space-x-2">
                  <button
                    onClick={toggleSearch}
                    className="p-2 bg-gray-50 rounded-full border border-gray-100 text-gray-600 hover:bg-gray-100 transition"
                  >
                    <Search size={20} />
                  </button>
                  <button
                    onClick={() => setFilterPanelOpen(!filterPanelOpen)}
                    className={`p-2 rounded-full border transition ${filterPanelOpen || seasonFilter !== 'all' || sortBy !== 'recent'
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    <SlidersHorizontal size={20} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Pill Selector */}
        <div className="px-6">
          <div className="bg-gray-100 p-1.5 rounded-2xl flex font-medium text-sm">
            {(['closet', 'looks', 'sales'] as ViewType[]).map((view) => (
              <button
                key={view}
                onClick={() => setActiveView(view)}
                className={`flex-1 py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-1 ${activeView === view
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
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
        <div className="mx-6 mb-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 animate-fade-in">
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
            <p className="text-xs text-gray-400 mb-2">Temporada</p>
            <div className="flex gap-2 flex-wrap">
              {SEASONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSeasonFilter(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${seasonFilter === s.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-2">Ordenar por</p>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'recent' as const, label: 'Recientes' },
                { id: 'most-used' as const, label: 'Más usados' },
                { id: 'least-used' as const, label: 'Menos usados' },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${sortBy === s.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <p className="text-xs text-gray-400 mb-2">Color</p>
            <div className="flex gap-2 flex-wrap">
              {availableColors.map(c => (
                <button
                  key={c}
                  onClick={() => setColorFilter(c)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${colorFilter === c ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
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
          {/* Category pills */}
          <div className="flex space-x-2 overflow-x-auto no-scrollbar mb-4 pb-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${filter === cat.id
                  ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                  : 'bg-white text-gray-500 border-gray-200'
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Count & sort info */}
          <div className="flex justify-between items-center px-1 mb-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span>{filteredItems.length} Prendas</span>
            <span>
              {sortBy === 'recent' && 'Orden: Recientes'}
              {sortBy === 'most-used' && 'Orden: Más usados'}
              {sortBy === 'least-used' && 'Orden: Menos usados'}
            </span>
          </div>

          {/* Usage Insights */}
          <div className="grid grid-cols-2 gap-3 mb-4 animate-fade-in">
            <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Top usadas</p>
              {topUsedItems.length === 0 ? (
                <p className="text-xs text-gray-400">Sin datos aun</p>
              ) : (
                <div className="space-y-2">
                  {topUsedItems.slice(0, 3).map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      {item.imageUrl && <img src={item.imageUrl} alt={item.name || item.type} className="w-8 h-8 rounded-lg object-cover" />}
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-700 truncate">{item.name || item.type}</p>
                        <p className="text-[10px] text-gray-400">{item.usageCount || 0} usos</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-sm">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Poco usadas</p>
              {lowUsageItems.length === 0 ? (
                <p className="text-xs text-gray-400">Todo en rotacion</p>
              ) : (
                <div className="space-y-2">
                  {lowUsageItems.slice(0, 3).map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      {item.imageUrl && <img src={item.imageUrl} alt={item.name || item.type} className="w-8 h-8 rounded-lg object-cover" />}
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-700 truncate">{item.name || item.type}</p>
                        <p className="text-[10px] text-gray-400">{item.usageCount || 0} usos</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Empty state */}
          {filteredItems.length === 0 && (
            <div className="text-center py-16">
              <Shirt size={48} className="mx-auto text-gray-200 mb-3" />
              {searchQuery ? (
                <>
                  <p className="text-gray-400 text-sm">Sin resultados para "{searchQuery}"</p>
                  <button
                    onClick={() => setSearchQuery('')}
                    className="mt-3 text-primary text-sm font-medium"
                  >
                    Limpiar búsqueda
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-sm">Tu armario está vacío</p>
                  <p className="text-xs text-gray-300 mt-1">Añade tu primera prenda</p>
                </>
              )}
            </div>
          )}

          {/* Garments Grid */}
          <div className="grid grid-cols-2 gap-4">
            {filteredItems.map((garment) => (
              <div
                key={garment.id}
                onClick={() => openDetailModal(garment)}
                className="group stagger-child relative bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md hover:border-primary/50 transition-all cursor-pointer"
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
                        onClick={(e) => { e.stopPropagation(); onRemoveGarment(garment.id); }}
                        className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm"
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
                        className="bg-white/90 backdrop-blur-sm p-1.5 rounded-full text-emerald-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-sm"
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
                  <div className="absolute bottom-14 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-bold text-primary shadow-sm">
                    {garment.usageCount || 0} usos
                  </div>
                )}

                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-800 truncate">{garment.name || garment.type}</p>
                  <div className="flex items-center justify-between text-xs text-gray-400 capitalize mt-0.5">
                    <span>{garment.color}</span>
                    {garment.brand && <span className="text-[10px]">{garment.brand}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* FAB */}
          <button
            onClick={() => setIsAdding(true)}
            className="fixed bottom-28 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-lg shadow-primary/40 flex items-center justify-center hover:scale-105 transition-transform z-40"
          >
            <Plus size={28} />
          </button>
        </div>
      )}

      {/* VIEW: LOOKS */}
      {activeView === 'looks' && (
        <div className="px-6 flex-1 overflow-y-auto no-scrollbar pb-24 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800">Tus Looks</h3>
            <button
              onClick={() => onNavigate('create')}
              className="text-primary text-xs font-bold bg-primary/10 px-3 py-1.5 rounded-full"
            >
              + Crear Look
            </button>
          </div>

          {looks.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles size={48} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">Aún no tienes looks guardados</p>
              <p className="text-xs text-gray-300 mt-1">Crea tu primer look en minutos</p>
              <button
                onClick={() => onNavigate('create')}
                className="mt-4 text-primary text-sm font-medium"
              >
                Crear Look
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {looks.map((look) => {
                const lookImg = getLookImage(look);
                return (
                  <div
                    key={look.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100"
                  >
                    <div className="aspect-[3/4] bg-gray-50 relative">
                      {lookImg ? (
                        <img src={lookImg} alt={look.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Sparkles size={28} />
                        </div>
                      )}
                      {look.isPublic && (
                        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-[10px] font-bold text-primary px-2 py-1 rounded-full">
                          Publico
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-gray-800 truncate">{look.name}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400 mt-0.5">
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
              <div className="bg-white/20 p-2 rounded-xl">
                <DollarSign size={20} className="text-white" />
              </div>
            </div>
            <div className="mt-4 flex space-x-3 text-xs font-medium">
              <span className="bg-white/20 px-2 py-1 rounded-lg">{salesItems.length} en venta</span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-800">En tu escaparate</h3>
            <button
              onClick={() => { setIsSelling(true); setSelectedForSale(null); setSalePrice(''); }}
              className="text-primary text-xs font-bold bg-primary/10 px-3 py-1.5 rounded-full"
            >
              + Nueva Venta
            </button>
          </div>

          {salesItems.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag size={48} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">No tienes prendas en venta</p>
              <p className="text-xs text-gray-300 mt-1">Vende lo que ya no uses</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {salesItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative"
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
                    <p className="text-xs font-bold text-gray-700 truncate">{item.name || item.type}</p>
                    {item.condition && (
                      <p className="text-[10px] text-gray-400 capitalize mt-0.5">{item.condition}</p>
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
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl animate-pop-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 p-6 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-800">Nueva Prenda</h2>
              <button onClick={resetAddModal}>
                <X size={24} className="text-gray-400" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 space-y-4">
              {/* Image Upload */}
              <div>
                {!newImage ? (
                  <label className="w-full aspect-[4/3] bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                    <Camera size={40} className="text-gray-300 mb-2" />
                    <span className="text-sm text-gray-500 font-medium">Subir foto</span>
                    <span className="text-xs text-gray-300 mt-1">JPG, PNG hasta 10MB</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                  </label>
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
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Nombre</label>
                <input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ej: Camiseta rayas azul"
                  className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Categoría</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setNewCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${newCategory === cat.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
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
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Color</label>
                  <input
                    value={newColor}
                    onChange={e => setNewColor(e.target.value)}
                    placeholder="Ej: azul"
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Marca</label>
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
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">Temporada</label>
                <div className="flex gap-2 flex-wrap">
                  {SEASONS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setNewSeason(s.id as any)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${newSeason === s.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'
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
                disabled={!newImage}
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
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl animate-pop-in overflow-hidden">
            <div className="p-6 border-b border-gray-50 text-center">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <SellIcon size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Poner en venta</h2>
              <p className="text-xs text-gray-400 mt-1">Convierte tu armario en ingresos</p>
            </div>

            <div className="p-6 space-y-4">
              {selectedForSale && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl">
                  <img src={selectedForSale.imageUrl} className="w-12 h-12 rounded-xl object-cover" alt="" />
                  <div>
                    <p className="text-sm font-bold text-gray-700">{selectedForSale.name || selectedForSale.type}</p>
                    <p className="text-[10px] text-gray-400 capitalize">{selectedForSale.color} · {selectedForSale.brand || 'Marca no especif.'}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Precio de venta</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">€</span>
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
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Estado</label>
                  <select
                    value={saleCondition}
                    onChange={e => setSaleCondition(e.target.value)}
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium outline-none appearance-none"
                  >
                    <option value="nuevo">Nuevo</option>
                    <option value="como nuevo">Como nuevo</option>
                    <option value="bueno">Buen estado</option>
                    <option value="usado">Usado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Talla</label>
                  <input
                    value={saleSize}
                    onChange={e => setSaleSize(e.target.value)}
                    placeholder="M, 42, etc"
                    className="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-gray-50 flex gap-3">
              <button
                onClick={() => setIsSelling(false)}
                className="flex-1 py-3 text-sm font-bold text-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSale}
                className="flex-[2] bg-emerald-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-colors"
                disabled={!salePrice}
              >
                Publicar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      <ProductDetailModal
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />
    </div>
  );
};

export default Wardrobe;
