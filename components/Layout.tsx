import React, { useMemo, useState, useEffect } from 'react';
import { Home, Shirt, PlusSquare, Users, User, Map, RefreshCcw, X, Luggage, WashingMachine } from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';
import { useGlobalState } from '../src/context/GlobalStateContext';
import NotificationBell from './NotificationBell';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { t } = useLanguage();
  const [showWardrobeSubmenu, setShowWardrobeSubmenu] = useState(false);
  const [washingAnimation, setWashingAnimation] = useState(false);
  const [showWashingModal, setShowWashingModal] = useState(false);
  const [dragOverLavadora, setDragOverLavadora] = useState(false);
  const { garments, updateGarment } = useGlobalState();

  const washingAnimRef = React.useRef(washingAnimation);
  washingAnimRef.current = washingAnimation;

  const handleDropWashing = (e: React.DragEvent) => {
    e.preventDefault();
    const garmentId = e.dataTransfer.getData('garmentId');
    const garment = garments.find(g => g.id === garmentId);
    if (garment && !garment.isWashing && !garment.forSale) {
      updateGarment({ ...garment, isWashing: true });
      window.dispatchEvent(new CustomEvent('animateLavadora'));
    }
  };

  useEffect(() => {
    const handleAnimate = () => {
      setShowWardrobeSubmenu(true);
      setWashingAnimation(true);
      setTimeout(() => {
        setWashingAnimation(false);
        setShowWardrobeSubmenu(false);
      }, 2100);
    };

    const handleDragStart = () => setShowWardrobeSubmenu(true);
    const handleDragEnd = () => {
      setTimeout(() => {
        if (!washingAnimRef.current) {
          setShowWardrobeSubmenu(false);
        }
      }, 50);
    };

    window.addEventListener('animateLavadora', handleAnimate as EventListener);
    window.addEventListener('dragStartGarment', handleDragStart as EventListener);
    window.addEventListener('dragEndGarment', handleDragEnd as EventListener);
    return () => {
      window.removeEventListener('animateLavadora', handleAnimate as EventListener);
      window.removeEventListener('dragStartGarment', handleDragStart as EventListener);
      window.removeEventListener('dragEndGarment', handleDragEnd as EventListener);
    };
  }, []);

  const navItems = [
    { id: 'home', icon: Home, label: t('home') },
    { id: 'wardrobe', icon: Shirt, label: t('wardrobe') },
    { id: 'create', icon: PlusSquare, label: t('create') },
    { id: 'social', icon: Users, label: t('social') },
    { id: 'profile', icon: User, label: t('profile') },
  ];

  const activeIndex = useMemo(() => {
    let targetTab = activeTab;
    if (activeTab === 'planner' || activeTab === 'suitcase') {
      targetTab = 'wardrobe';
    }
    return navItems.findIndex(item => item.id === targetTab);
  }, [activeTab, navItems]);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden relative font-sans">
      <NotificationBell />

      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {children}
      </main>

      <div className="fixed bottom-6 left-4 right-4 z-50 flex justify-center pointer-events-none">
        <nav className="relative w-full max-w-lg h-16 bg-white/80 backdrop-blur-md border border-white/40 shadow-xl rounded-full flex items-center p-1 pointer-events-auto">

          {activeIndex !== -1 && (
            <div
              className="absolute top-1 bottom-1 rounded-full bg-primary shadow-md transition-all duration-300 ease-out"
              style={{
                left: `calc(0.25rem + ${activeIndex} * ((100% - 0.5rem) / ${navItems.length}))`,
                width: `calc((100% - 0.5rem) / ${navItems.length})`
              }}
            />
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return item.id === 'wardrobe' ? (
              <div 
                key={item.id} 
                className="relative z-10 flex-1 h-full"
              >
                {showWardrobeSubmenu && (
                  <div className="absolute bottom-[110%] left-1/2 -translate-x-1/2 flex gap-4 mb-2 animate-fade-in pointer-events-auto">
                    {/* Suitcase Bubble */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => { setShowWardrobeSubmenu(false); onTabChange('suitcase'); }}
                        className="bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-[0_8px_16px_rgba(0,0,0,0.1)] border border-white/50 text-indigo-500 hover:scale-110 hover:bg-indigo-50 transition-all flex flex-col items-center gap-1 group"
                      >
                        <Luggage size={22} className="group-hover:-translate-y-1 transition-transform" />
                      </button>
                      <span className="text-[10px] font-bold text-gray-600 bg-white/80 px-2 py-0.5 rounded-full mt-1.5 shadow-sm">Viajes</span>
                    </div>

                    {/* Lavadora Bubble */}
                    <div className="flex flex-col items-center">
                      <button
                        onClick={() => { setShowWardrobeSubmenu(false); setShowWashingModal(true); }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverLavadora(true); }}
                        onDragLeave={() => setDragOverLavadora(false)}
                        onDrop={(e) => { setDragOverLavadora(false); handleDropWashing(e); }}
                        className={`bg-white/90 backdrop-blur-sm p-3 rounded-full shadow-[0_8px_16px_rgba(0,0,0,0.1)] border border-white/50 text-blue-500 hover:scale-110 hover:bg-blue-50 transition-all flex flex-col items-center gap-1 relative overflow-hidden ${washingAnimation ? 'wash shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-125' : ''} ${dragOverLavadora && !washingAnimation ? 'animate-bounce ring-4 ring-blue-300' : ''}`}
                      >
                        <WashingMachine size={22} className={washingAnimation ? 'animate-spin' : ''} />
                        {garments.filter(g => g.isWashing).length > 0 && !washingAnimation && (
                          <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
                            {garments.filter(g => g.isWashing).length}
                          </div>
                        )}
                      </button>
                      <span className="text-[10px] font-bold text-gray-600 bg-white/80 px-2 py-0.5 rounded-full mt-1.5 shadow-sm">Lavar</span>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (isActive) setShowWardrobeSubmenu(!showWardrobeSubmenu);
                    else { onTabChange(item.id); setShowWardrobeSubmenu(true); }
                  }}
                  className="w-full h-full flex flex-col items-center justify-center group outline-none gap-1.5"
                >
                  <div className={`transition-all duration-300 transform ${isActive ? '-translate-y-0.5' : 'translate-y-0.5'}`}>
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-primary/70'}`} />
                  </div>
                  <span className={`text-[10px] font-semibold tracking-wide transition-colors duration-300 ${isActive ? 'text-white/95' : 'text-gray-400'}`}>{item.label}</span>
                </button>
              </div>
            ) : (
              <button
                key={item.id}
                onClick={() => { setShowWardrobeSubmenu(false); onTabChange(item.id); }}
                className="relative z-10 flex-1 h-full flex flex-col items-center justify-center group outline-none gap-1.5"
              >
                <div className={`transition-all duration-300 transform ${isActive ? '-translate-y-0.5' : 'translate-y-0.5'}`}>
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={`transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-primary/70'}`} />
                </div>
                <span className={`text-[10px] font-semibold tracking-wide transition-colors duration-300 ${isActive ? 'text-white/95' : 'text-gray-400'}`}>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      {/* Washing Machine Modal Layer */}
      {showWashingModal && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in pointer-events-auto">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-pop-in">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center">
                  <RefreshCcw size={20} className={garments.some(g => g.isWashing) ? 'animate-[spin_4s_linear_infinite]' : ''} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">Lavadora</h3>
                  <p className="text-xs text-gray-500">Recupera tu ropa limpia</p>
                </div>
              </div>
              <button
                onClick={() => setShowWashingModal(false)}
                className="p-2 -mr-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            
            {garments.filter(g => g.isWashing).length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-2xl">
                <RefreshCcw size={24} className="mx-auto text-gray-300 mb-2" />
                <p className="text-xs text-gray-400 font-medium">Lavadora vacía.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto no-scrollbar pb-2">
                {garments.filter(g => g.isWashing).map(g => (
                  <div key={g.id} className="relative aspect-square rounded-xl bg-gray-100 overflow-hidden border border-gray-200 group">
                    <img src={g.imageUrl} alt={g.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                      <button 
                        onClick={() => updateGarment({ ...g, isWashing: false })}
                        className="bg-white text-xs text-blue-600 font-bold px-3 py-1 rounded-lg shadow-sm hover:scale-105 transition-transform"
                      >
                        Sacar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
