import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Layout from './components/Layout';
import Home from './pages/Home';
import Wardrobe from './pages/Wardrobe';
import CreateLook from './pages/CreateLook';
import Planner from './pages/Planner';
import Social from './pages/Social';
import Profile from './pages/Profile';
import Suitcase from './pages/Suitcase';
import AuthPage from './pages/AuthPage';
import { GlobalStateProvider, useGlobalState } from './src/context/GlobalStateContext';
import { useLanguage, LanguageProvider } from './src/context/LanguageContext';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [socialSubTab, setSocialSubTab] = useState<string | null>(null);
  const { t } = useLanguage();

  // Listen for global navigation events (e.g. from notification clicks)
  useEffect(() => {
    const handleNavigate = (e: CustomEvent) => {
      const { tab, subTab } = e.detail || {};
      if (tab) {
        setActiveTab(tab);
        if (subTab) {
          setSocialSubTab(subTab);
        }
      }
    };
    window.addEventListener('navigateTo', handleNavigate as EventListener);
    return () => window.removeEventListener('navigateTo', handleNavigate as EventListener);
  }, []);

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
            onNavigate={setActiveTab}
            plannerEntries={planner}
            garments={garments}
          />
        );
      case 'wardrobe':
        return (
          <Wardrobe
            garments={garments}
            onAddGarment={addGarment}
            onRemoveGarment={removeGarment}
            onUpdateGarment={updateGarment}
            looks={looks}
            planner={planner}
            onUpdatePlanner={updatePlannerEntry}
            onNavigate={setActiveTab}
            trips={trips}
            onUpdateTrip={updateTrip}
          />
        );
      case 'create':
        return (
          <CreateLook
            garments={garments}
            onSaveLook={(look) => saveLook(look, () => setActiveTab('wardrobe'))}
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
        return <Social user={user} garments={garments} onNavigate={setActiveTab} initialSubTab={socialSubTab} onSubTabConsumed={() => setSocialSubTab(null)} />;
      case 'profile':
        return (
          <Profile
            user={user}
            plannerEntries={planner}
            looks={looks}
            onUpdateUser={handleUpdateUser}
            garments={garments}
            onNavigate={setActiveTab}
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
            onNavigate={setActiveTab}
            plannerEntries={planner}
            garments={garments}
          />
        );
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
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
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <GlobalStateProvider>
        <AppContent />
      </GlobalStateProvider>
    </LanguageProvider>
  );
};

export default App;
