import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X, RotateCcw } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading' | 'warning';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  onClose?: () => void;
  onUndo?: () => void;
  actionLabel?: string;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (toast.type !== 'loading' && toast.duration) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / toast.duration!) * 100);
        setProgress(remaining);

        if (remaining === 0) {
          clearInterval(interval);
          setIsExiting(true);
          setTimeout(() => {
            onClose();
            toast.onClose?.();
          }, 300);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [toast, onClose]);

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-emerald-50 border border-emerald-200',
          icon: <CheckCircle2 size={20} className="text-emerald-600" />,
          text: 'text-emerald-900',
          bar: 'bg-emerald-500',
          action: 'text-emerald-700 hover:bg-emerald-100'
        };
      case 'error':
        return {
          bg: 'bg-red-50 border border-red-200',
          icon: <AlertCircle size={20} className="text-red-600" />,
          text: 'text-red-900',
          bar: 'bg-red-500',
          action: 'text-red-700 hover:bg-red-100'
        };
      case 'warning':
        return {
          bg: 'bg-amber-50 border border-amber-200',
          icon: <AlertCircle size={20} className="text-amber-600" />,
          text: 'text-amber-900',
          bar: 'bg-amber-500',
          action: 'text-amber-700 hover:bg-amber-100'
        };
      case 'loading':
        return {
          bg: 'bg-blue-50 border border-blue-200',
          icon: <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />,
          text: 'text-blue-900',
          bar: 'bg-blue-500',
          action: 'text-blue-700 hover:bg-blue-100'
        };
      case 'info':
      default:
        return {
          bg: 'bg-[var(--bg-base)] border border-[var(--border-light)]',
          icon: <Info size={20} className="text-[var(--text-secondary)]" />,
          text: 'text-[var(--text-primary)]',
          bar: 'bg-gray-500',
          action: 'text-[var(--text-primary)] hover:bg-[var(--bg-base)]'
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      className={`
        ${styles.bg} rounded-2xl p-4 shadow-lg flex items-center gap-3 animate-slide-in-up max-w-sm
        transition-all duration-300
        ${isExiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
      `}
    >
      {/* Icon */}
      <div className="flex-shrink-0">{styles.icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-sm ${styles.text}`}>{toast.message}</p>
        
        {/* Undo Button */}
        {toast.onUndo && (
          <button
            onClick={() => {
              toast.onUndo?.();
              setIsExiting(true);
              setTimeout(onClose, 300);
            }}
            className={`text-xs font-semibold mt-1 flex items-center gap-1 ${styles.action} px-2 py-1 rounded transition-colors`}
          >
            <RotateCcw size={14} />
            Deshacer
          </button>
        )}
      </div>

      {/* Close button */}
      {toast.type !== 'loading' && (
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(onClose, 300);
          }}
          className="flex-shrink-0 text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <X size={18} />
        </button>
      )}

      {/* Progress bar */}
      {toast.type !== 'loading' && toast.duration && (
        <div className="absolute bottom-0 left-0 h-1 bg-gray-200 w-full rounded-b-2xl overflow-hidden">
          <div
            className={`h-full ${styles.bar} transition-all duration-100`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-28 right-6 z-[200] flex flex-col gap-3 pointer-events-auto max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={() => onRemove(toast.id)} />
      ))}
    </div>
  );
};

export default Toast;
