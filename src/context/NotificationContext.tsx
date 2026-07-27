import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  notifications: Notification[];
  notify: (message: string, type?: NotificationType) => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(t => clearTimeout(t));
      timeoutsRef.current.clear();
    };
  }, []);

  const notify = (message: string, type: NotificationType = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36);
    setNotifications(prev => [...prev, { id, message, type }]);
    
    const timeoutId = setTimeout(() => {
      removeNotification(id);
      timeoutsRef.current.delete(id);
    }, 5000);
    timeoutsRef.current.set(id, timeoutId);
  };

  const removeNotification = (id: string) => {
    const t = timeoutsRef.current.get(id);
    if (t) { clearTimeout(t); timeoutsRef.current.delete(id); }
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ notifications, notify, removeNotification }}>
      {children}
      <NotificationContainer notifications={notifications} onClose={removeNotification} />
    </NotificationContext.Provider>
  );
};

const NotificationContainer: React.FC<{
  notifications: Notification[];
  onClose: (id: string) => void;
}> = ({ notifications, onClose }) => {
  if (notifications.length === 0) return null;

  const getTypeStyles = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'bg-green-500 text-white';
      case 'error': return 'bg-red-500 text-white';
      case 'warning': return 'bg-yellow-500 text-white';
      default: return 'bg-blue-500 text-white';
    }
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✗';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {notifications.map(notif => (
        <div
          key={notif.id}
          className={`${getTypeStyles(notif.type)} px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-md animate-slide-in pointer-events-auto`}
        >
          <span className="text-xl font-bold">{getIcon(notif.type)}</span>
          <span className="flex-1 text-sm font-medium">{notif.message}</span>
          <button
            onClick={() => onClose(notif.id)}
            className="text-white hover:text-gray-200 font-bold text-xl leading-none"
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};
