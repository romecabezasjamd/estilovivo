import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import Wardrobe from './pages/Wardrobe';
import CreateLook from './pages/CreateLook';
import Planner from './pages/Planner';
import Social from './pages/Social';
import Profile from './pages/Profile';
import Suitcase from './pages/Suitcase';
import AuthPage from './pages/AuthPage';
import { UserState, Garment, Look, PlannerEntry, Trip } from './types';
import { api } from './services/api';
import { useLocalStorage, loadFromLocalStorage } from './hooks/useLocalStorage';
import { useNotification } from './src/context/NotificationContext';
import { applyTheme, getSavedTheme } from './src/utils/theme';
import { useLanguage, LanguageProvider } from './src/context/LanguageContext';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState('home');
  const [isLoading, setIsLoading] = useState(true);
  const { notify } = useNotification();
  const { t } = useLanguage();

  // GLOBAL STATE
  const [user, setUser] = useState<UserState | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [planner, setPlanner] = useState<PlannerEntry[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);

  // Fetch initial data & check auth
  useEffect(() => {
    // Apply saved theme immediately
    applyTheme(getSavedTheme());

    const init = async () => {
      const hasSession = localStorage.getItem('beyour_user');
      if (hasSession) {
        try {
          // Fetch user from API for fresh data
          let userData: UserState;
          try {
            userData = await api.getMe();
            setUser(userData);
            localStorage.setItem('beyour_user', JSON.stringify(userData));
          } catch {
            const savedUser = localStorage.getItem('beyour_user');
            if (savedUser) {
              userData = JSON.parse(savedUser);
              setUser(userData);
            } else {
              throw new Error('No user data');
            }
          }

          // Fetch data in parallel
          const [fetchedGarments, fetchedLooks, fetchedPlanner, fetchedTrips] = await Promise.allSettled([
            api.getGarments(),
            api.getLooks(),
            api.getPlanner(),
            api.getTrips(),
          ]);

          // Use API results if available, fallback to localStorage
          if (fetchedGarments.status === 'fulfilled') {
            setGarments(fetchedGarments.value);
            localStorage.setItem('beyour_garments', JSON.stringify(fetchedGarments.value));
          } else {
            const saved = loadFromLocalStorage('beyour_garments', []);
            setGarments(saved);
          }

          if (fetchedLooks.status === 'fulfilled') {
            setLooks(fetchedLooks.value);
            localStorage.setItem('beyour_looks', JSON.stringify(fetchedLooks.value));
          } else {
            const saved = loadFromLocalStorage('beyour_looks', []);
            setLooks(saved);
          }

          if (fetchedPlanner.status === 'fulfilled') {
            setPlanner(fetchedPlanner.value);
            localStorage.setItem('beyour_planner', JSON.stringify(fetchedPlanner.value));
          } else {
            const saved = loadFromLocalStorage('beyour_planner', []);
            setPlanner(saved);
          }

          if (fetchedTrips.status === 'fulfilled') {
            setTrips(fetchedTrips.value);
            localStorage.setItem('beyour_trips', JSON.stringify(fetchedTrips.value));
          } else {
            const saved = loadFromLocalStorage('beyour_trips', []);
            setTrips(saved);
          }
        } catch (error) {
          console.error("Critical error during initialization:", error);
          localStorage.removeItem('beyour_token');
          localStorage.removeItem('beyour_user');
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const handleAuthSuccess = (userData: UserState) => {
    setUser(userData);
    localStorage.setItem('beyour_user', JSON.stringify(userData));
    window.location.reload();
  };

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

  // HANDLERS
  const handleMoodChange = async (mood: string) => {
    const updated = { ...user, mood: mood };
    setUser(updated);
    try {
      await api.updateProfile({ mood });
    } catch (e) {
      console.warn('Failed to save mood:', e);
    }
  };

  const addGarment = async (garment: Garment, file?: File) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticGarment = { ...garment, id: tempId };

    // Optimistic update
    setGarments(prev => [optimisticGarment, ...prev]);
    localStorage.setItem('beyour_garments', JSON.stringify([optimisticGarment, ...garments]));

    try {
      const saved = await api.addGarment({
        file,
        name: garment.name || garment.type,
        category: garment.type,
        color: garment.color,
        season: garment.season,
      });

      // Replace temp with real
      setGarments(prev => {
        const updated = prev.map(g => g.id === tempId ? saved : g);
        localStorage.setItem('beyour_garments', JSON.stringify(updated));
        return updated;
      });

      notify(`✓ ${t('garmentAdded')}`, 'success');
    } catch (error) {
      // Rollback on error
      setGarments(prev => {
        const filtered = prev.filter(g => g.id !== tempId);
        localStorage.setItem('beyour_garments', JSON.stringify(filtered));
        return filtered;
      });

      notify(`✗ ${t('garmentAddError')}`, 'error');
      console.error("Error adding garment:", error);
    }
  };

  const removeGarment = async (id: string) => {
    const previousGarments = [...garments];
    const filtered = garments.filter(g => g.id !== id);

    // Optimistic update
    setGarments(filtered);
    localStorage.setItem('beyour_garments', JSON.stringify(filtered));

    try {
      await api.deleteGarment(id);
      notify(`✓ ${t('garmentDeleted')}`, 'success');
    } catch (error) {
      // Rollback
      setGarments(previousGarments);
      localStorage.setItem('beyour_garments', JSON.stringify(previousGarments));
      notify(`✗ ${t('garmentDeleteError')}`, 'error');
      console.error("Error deleting garment:", error);
    }
  };

  const updateGarment = async (g: Garment) => {
    const previousGarments = [...garments];
    const updated = garments.map(item => item.id === g.id ? g : item);

    // Optimistic update
    setGarments(updated);
    localStorage.setItem('beyour_garments', JSON.stringify(updated));

    try {
      await api.updateGarment(g.id, g);
      notify(`✓ ${t('garmentUpdated')}`, 'success');
    } catch (error) {
      // Rollback
      setGarments(previousGarments);
      localStorage.setItem('beyour_garments', JSON.stringify(previousGarments));
      notify(`✗ ${t('garmentUpdateError')}`, 'error');
      console.error("Error updating garment:", error);
    }
  };

  const saveLook = async (look: Look) => {
    const tempId = `temp-${Date.now()}`;
    const optimisticLook = { ...look, id: tempId };

    // Optimistic update
    setLooks(prev => [optimisticLook, ...prev]);
    localStorage.setItem('beyour_looks', JSON.stringify([optimisticLook, ...looks]));

    try {
      const savedLook = await api.saveLook(look);

      // Replace temp with real
      setLooks(prev => {
        const updated = prev.map(l => l.id === tempId ? savedLook : l);
        localStorage.setItem('beyour_looks', JSON.stringify(updated));
        return updated;
      });

      notify(`✓ ${t('lookSaved')}`, 'success');
      setActiveTab('wardrobe');
    } catch (error) {
      // Rollback
      setLooks(prev => {
        const filtered = prev.filter(l => l.id !== tempId);
        localStorage.setItem('beyour_looks', JSON.stringify(filtered));
        return filtered;
      });

      notify(`✗ ${t('lookSaveError')}`, 'error');
      console.error("Error saving look:", error);
      setActiveTab('wardrobe');
    }
  };

  const deleteLook = async (id: string) => {
    const previousLooks = [...looks];
    const filtered = looks.filter(l => l.id !== id);

    // Optimistic update
    setLooks(filtered);
    localStorage.setItem('beyour_looks', JSON.stringify(filtered));

    try {
      await api.deleteLook(id);
      notify(`✓ ${t('lookDeleted')}`, 'success');
    } catch (error) {
      // Rollback
      setLooks(previousLooks);
      localStorage.setItem('beyour_looks', JSON.stringify(previousLooks));
      notify(`✗ ${t('lookDeleteError')}`, 'error');
      console.error("Error deleting look:", error);
    }
  };

  const updatePlannerEntry = async (entry: PlannerEntry) => {
    setPlanner(prev => {
      const filtered = prev.filter(p => p.date !== entry.date);
      const updated = [...filtered, entry];
      localStorage.setItem('beyour_planner', JSON.stringify(updated));
      return updated;
    });
    try {
      const saved = await api.updatePlanner(entry);
      setPlanner(prev => {
        const filtered = prev.filter(p => p.date !== entry.date);
        const final = [...filtered, saved];
        localStorage.setItem('beyour_planner', JSON.stringify(final));
        return final;
      });
    } catch (error) {
      console.error("Error updating planner:", error);
    }
  };

  const handleUpdateUser = async (updatedUser: UserState) => {
    setUser(updatedUser);
    localStorage.setItem('beyour_user', JSON.stringify(updatedUser));
    try {
      await api.updateProfile(updatedUser);
    } catch (error) {
      console.warn("Error saving profile:", error);
    }
  };

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
          />
        );
      case 'create':
        return <CreateLook garments={garments} onSaveLook={saveLook} />;
      case 'planner':
        return (
          <Planner
            looks={looks}
            plannerEntries={planner}
            onUpdateEntry={updatePlannerEntry}
          />
        );
      case 'social':
        return <Social user={user} garments={garments} onNavigate={setActiveTab} />;
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
            onAddTrip={async (newTrip) => {
              const newTrips = [newTrip, ...trips];
              setTrips(newTrips);
              localStorage.setItem('beyour_trips', JSON.stringify(newTrips));
              try {
                const saved = await api.saveTrip(newTrip);
                const updated = [saved, ...trips];
                setTrips(updated);
                localStorage.setItem('beyour_trips', JSON.stringify(updated));
              } catch (error) {
                console.error("Error saving trip:", error);
              }
            }}
            onDeleteTrip={async (id) => {
              const filtered = trips.filter(t => t.id !== id);
              setTrips(filtered);
              localStorage.setItem('beyour_trips', JSON.stringify(filtered));
              try {
                await api.deleteTrip(id);
              } catch (error) {
                console.error("Error deleting trip:", error);
              }
            }}
            onUpdateTrip={async (trip) => {
              const updated = trips.map(t => t.id === trip.id ? trip : t);
              setTrips(updated);
              localStorage.setItem('beyour_trips', JSON.stringify(updated));
              try {
                await api.updateTrip(trip);
              } catch (error) {
                console.error("Error updating trip:", error);
              }
            }}
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
      {renderActivePage()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;
