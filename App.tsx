import React, { useState, useEffect, lazy, Suspense, useCallback } from 'react';
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
import { GlobalStateProvider, useGlobalState } from './src/context/GlobalStateContext';
import { LanguageProvider } from './src/context/LanguageContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { DarkModeProvider } from './src/context/DarkModeContext';
import { resolveNavigation } from './src/utils/navigation';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [socialSubTab, setSocialSubTab] = useState<string | null>(null);
  const [wardrobeIntent, setWardrobeIntent] = useState<'looks' | 'createLook' | null>(null);

  const handleNavigate = useCallback((tab: string, subTab?: string) => {
    if (tab === 'community') {
      setSocialSubTab(subTab || 'feed');
      setActiveTab('social');
      return;
    }
    if (tab === 'chat') {
      setSocialSubTab('chat');
      setActiveTab('social');
      return;
    }
    const resolved = resolveNavigation(tab, subTab);
    setActiveTab(resolved.tab);
    if (resolved.wardrobeIntent) {
      setWardrobeIntent(resolved.wardrobeIntent);
    } else if (resolved.tab !== 'wardrobe') {
      setWardrobeIntent(null);
    }
    if (subTab && resolved.tab === 'social') setSocialSubTab(subTab);
  }, []);

  // Listen for global navigation events (e.g. from notification clicks)
  useEffect(() => {
    const handleNavigateEvent = (e: CustomEvent) => {
      const { tab, subTab } = e.detail || {};
      if (tab) {
        handleNavigate(tab, subTab);
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  const renderActivePage = () => {
    switch (activeTab) {
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
        <div className="min-h-screen bg-white flex items-center justify-center">
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
