import React, { useState, useEffect, lazy, Suspense, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from './components/Layout';
const Home = lazy(() => import('./pages/Home'));
const Wardrobe = lazy(() => import('./pages/Wardrobe'));
const Planner = lazy(() => import('./pages/Planner'));
const Social = lazy(() => import('./pages/Social'));
const Profile = lazy(() => import('./pages/Profile'));
const Suitcase = lazy(() => import('./pages/Suitcase'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const VirtualTryOn = lazy(() => import('./pages/VirtualTryOn'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Premium = lazy(() => import('./pages/Premium'));
import { GlobalStateProvider, useGlobalState } from './src/context/GlobalStateContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { DarkModeProvider } from './src/context/DarkModeContext';
import { resolveNavigation } from './src/utils/navigation';

const AppContent: React.FC = () => {
  const getInitialTab = () => {
    const path = window.location.pathname;
    if (path === '/privacy') return 'privacy';
    const tabMap: Record<string, string> = {
      '/home': 'home',
      '/wardrobe': 'wardrobe',
      '/planner': 'planner',
      '/social': 'social',
      '/profile': 'profile',
      '/wishlist': 'wishlist',
      '/suitcase': 'suitcase',
      '/tryon': 'tryon',
      '/privacy': 'privacy',
      '/premium': 'premium',
    };
    return tabMap[path] || 'home';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [socialSubTab, setSocialSubTab] = useState<string | null>(null);
  const [wardrobeIntent, setWardrobeIntent] = useState<'looks' | 'createLook' | null>(null);
  const [plannerDate, setPlannerDate] = useState<string | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const skipHistory = useRef(false);

  const pushHistory = useCallback((tab: string) => {
    if (skipHistory.current) { skipHistory.current = false; return; }
    const url = tab === 'home' ? '/' : `/${tab}`;
    if (window.location.pathname !== url) {
      window.history.pushState({}, '', url);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/look/')) {
        skipHistory.current = true;
        setSocialSubTab('feed');
        setActiveTab('social');
        return;
      }
      const tabMap: Record<string, string> = {
        '/home': 'home',
        '/wardrobe': 'wardrobe',
        '/planner': 'planner',
        '/social': 'social',
        '/profile': 'profile',
        '/wishlist': 'wishlist',
        '/suitcase': 'suitcase',
        '/tryon': 'tryon',
        '/privacy': 'privacy',
        '/premium': 'premium',
      };
      skipHistory.current = true;
      setActiveTab(tabMap[path] || 'home');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const handleNavigate = useCallback((tab: string, subTab?: string, extra?: string) => {
    const evt = new CustomEvent('profile-check-unsaved', { detail: { tab, subTab }, cancelable: true });
    window.dispatchEvent(evt);
    if (evt.defaultPrevented) return;

    if (tab === 'community') {
      setSocialSubTab(subTab || 'feed');
      setActiveTab('social');
      pushHistory('social');
      return;
    }
    if (tab === 'chat') {
      setSocialSubTab('chat');
      setActiveTab('social');
      pushHistory('social');
      return;
    }
    if (tab === 'planner' && extra) {
      setPlannerDate(extra);
    } else {
      setPlannerDate(undefined);
    }
    const resolved = resolveNavigation(tab, subTab);
    setActiveTab(resolved.tab);
    pushHistory(resolved.tab);
    if (resolved.wardrobeIntent) {
      setWardrobeIntent(resolved.wardrobeIntent);
    } else if (resolved.tab !== 'wardrobe') {
      setWardrobeIntent(null);
    }
    if (subTab && resolved.tab === 'social') setSocialSubTab(subTab);
  }, [pushHistory]);

  // Listen for global navigation events (e.g. from notification clicks)
  useEffect(() => {
    const handleNavigateEvent = (e: CustomEvent) => {
      const { tab, subTab } = e.detail || {};
      if (tab) {
        const evt = new CustomEvent('profile-check-unsaved', { detail: { tab, subTab }, cancelable: true });
        window.dispatchEvent(evt);
        if (!evt.defaultPrevented) {
          handleNavigate(tab, subTab);
        }
      }
    };
    window.addEventListener('navigateTo', handleNavigateEvent as EventListener);
    return () => window.removeEventListener('navigateTo', handleNavigateEvent as EventListener);
  }, [handleNavigate]);

  const {
    user, garments, looks, planner, trips, isLoading,
    handleAuthSuccess, handleMoodChange, handleUpdateUser,
    addGarment, removeGarment, updateGarment,
    saveLook, deleteLook,
    updatePlannerEntry,
    addTrip, deleteTrip, updateTrip,
  } = useGlobalState();

  // Check onboarding from user object — API is source of truth
  useEffect(() => {
    if (user && !(user as any).styleColors && !(user as any).styleStyles) {
      setShowOnboarding(true);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    if (activeTab === 'privacy') {
      return (
        <Suspense fallback={<div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
          <Privacy onBack={() => { window.history.pushState({}, '', '/'); setActiveTab('home') }} />
        </Suspense>
      );
    }
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  if (showOnboarding) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>}>
        <Onboarding onComplete={() => {
            try { localStorage.setItem('ev_onboarding_complete', 'true'); } catch {}
            setShowOnboarding(false);
            // Refresh user data to get updated style preferences
            import('./services/api').then(({ api }) => {
              api.getMe().then(u => {
                window.dispatchEvent(new CustomEvent('ev:user-loaded', { detail: u }));
              }).catch(() => {});
            });
          }} />
      </Suspense>
    );
  }

  const renderActivePage = () => {
    switch (activeTab) {
      case 'privacy':
        return <Privacy onBack={() => { window.history.pushState({}, '', '/'); setActiveTab('home') }} />;
      case 'premium':
        return <Premium onBack={() => { window.history.pushState({}, '', '/'); setActiveTab('home') }} />;
      case 'home':
        return (
          <Home
            user={user}
            looks={looks}
            onMoodChange={handleMoodChange}
            onNavigate={handleNavigate}
            plannerEntries={planner}
            garments={garments}
          />
        );
      case 'wardrobe':
      case 'create':
        return (
          <Wardrobe
            garments={garments}
            onAddGarment={addGarment}
            onRemoveGarment={removeGarment}
            onUpdateGarment={updateGarment}
            looks={looks}
            onDeleteLook={deleteLook}
            planner={planner}
            onUpdatePlanner={updatePlannerEntry}
            onNavigate={handleNavigate}
            onSaveLook={(look, after) => saveLook(look, () => {
              setWardrobeIntent('looks');
              after?.();
            })}
            wardrobeIntent={wardrobeIntent}
            onWardrobeIntentConsumed={() => setWardrobeIntent(null)}
            trips={trips}
            onUpdateTrip={updateTrip}
          />
        );
      case 'planner':
        return (
          <Planner
            looks={looks}
            plannerEntries={planner}
            onUpdateEntry={updatePlannerEntry}
            initialDate={plannerDate}
          />
        );
      case 'social':
        return <Social user={user} garments={garments} onNavigate={handleNavigate} initialSubTab={socialSubTab} onSubTabConsumed={() => setSocialSubTab(null)} />;
      case 'profile':
        return (
          <Profile
            user={user}
            plannerEntries={planner}
            looks={looks}
            onUpdateUser={handleUpdateUser}
            garments={garments}
            onNavigate={handleNavigate}
          />
        );
      case 'wishlist':
        return (
          <Wishlist
            garments={garments}
            onNavigate={handleNavigate}
          />
        );
      case 'suitcase':
        return (
          <Suitcase
            trips={trips}
            garments={garments}
            onAddTrip={addTrip}
            onDeleteTrip={deleteTrip}
            onUpdateTrip={updateTrip}
          />
        );
      default:
        return (
          <Home
            user={user}
            looks={looks}
            onMoodChange={handleMoodChange}
            onNavigate={handleNavigate}
            plannerEntries={planner}
            garments={garments}
          />
        );
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={handleNavigate}>
      <Suspense fallback={
        <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      }>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full"
          >
            {renderActivePage()}
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </Layout>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    const handleGlobalImageError = (e: Event) => {
      const target = e.target as HTMLImageElement;
      if (target && target.tagName === 'IMG' && !target.dataset.fallbackAttempted) {
        target.dataset.fallbackAttempted = 'true';
        const fallbacks = [
          'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSIyMCIgZmlsbD0iI2UyZThmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0iY2VudHJhbCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk0YTNiOCIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTgiPj88L3RleHQ+PC9zdmc+'
        ];
        target.src = fallbacks[0];
      }
    };
    document.addEventListener('error', handleGlobalImageError, true);
    return () => document.removeEventListener('error', handleGlobalImageError, true);
  }, []);

  return (
    <LanguageProvider>
      <ThemeProvider>
        <DarkModeProvider>
          <GlobalStateProvider>
            <AppContent />
          </GlobalStateProvider>
        </DarkModeProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
};

export default App;
