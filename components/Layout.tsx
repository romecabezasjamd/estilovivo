import React, { useMemo } from 'react';
import { Home, Shirt, PlusSquare, Users, User } from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { t } = useLanguage();
  const navItems = [
    { id: 'home', icon: Home, label: t('home') },
    { id: 'wardrobe', icon: Shirt, label: t('wardrobe') },
    { id: 'create', icon: PlusSquare, label: t('create') },
    { id: 'social', icon: Users, label: t('social') },
    { id: 'profile', icon: User, label: t('profile') },
  ];

  // Calculate index for the sliding animation
  const activeIndex = useMemo(() => {
    let targetTab = activeTab;
    if (activeTab === 'planner' || activeTab === 'suitcase') {
      targetTab = 'wardrobe';
    }
    return navItems.findIndex(item => item.id === targetTab);
  }, [activeTab, navItems]);

  return (
    <div className="flex flex-col h-screen w-full bg-gray-50 overflow-hidden relative font-sans">
      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {children}
      </main>

      {/* Floating Glass Navigation */}
      <div className="fixed bottom-6 left-4 right-4 z-50 flex justify-center pointer-events-none">
        <nav className="relative w-full max-w-lg h-16 bg-white/80 backdrop-blur-md border border-white/40 shadow-xl rounded-full flex items-center p-1 pointer-events-auto">

          {/* Sliding Pill Indicator */}
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

            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className="relative z-10 flex-1 h-full flex flex-col items-center justify-center group outline-none gap-1.5"
              >
                <div className={`transition-all duration-300 transform ${isActive ? '-translate-y-0.5' : 'translate-y-0.5'}`}>
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 2}
                    className={`transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-primary/70'}`}
                  />
                </div>

                <span className={`text-[10px] font-semibold tracking-wide transition-colors duration-300 ${isActive ? 'text-white/95' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};

export default Layout;
