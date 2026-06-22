import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = 'Eliminar',
  message = '¿Seguro que quieres eliminar esto? Esta acción no se puede deshacer.',
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  destructive = true,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onCancel}>
      <div className="bg-white w-full max-w-sm rounded-[1.5rem] shadow-2xl overflow-hidden animate-pop-in" onClick={e => e.stopPropagation()}>
        <div className="p-6 text-center">
          <div className={`w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center ${destructive ? 'bg-red-50' : 'bg-gray-50'}`}>
            <AlertTriangle size={28} className={destructive ? 'text-red-500' : 'text-gray-500'} />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 px-6 pb-6">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors active:scale-[0.98]"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 rounded-2xl text-sm font-bold text-white transition-colors active:scale-[0.98] ${destructive ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:opacity-90'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
