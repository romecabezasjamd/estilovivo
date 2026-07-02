import React, { useState, useMemo } from 'react';
import { TrendingDown, TrendingUp, Bell, BellOff } from 'lucide-react';

export interface PricePoint {
  date: Date;
  price: number;
}

export interface PricedItem {
  id: string;
  name: string;
  image: string;
  currentPrice: number;
  originalPrice: number;
  priceHistory: PricePoint[];
  priceDropNotificationEnabled?: boolean;
  targetPrice?: number;
}

interface PriceAlertProps {
  item: PricedItem;
  onNotificationToggle?: (itemId: string, enabled: boolean) => void;
  onTargetPriceSet?: (itemId: string, price: number) => void;
  compact?: boolean;
}

export const usePriceAlert = (item: PricedItem) => {
  const priceChangePercent = useMemo(() => {
    if (!item.originalPrice) return 0;
    return ((item.currentPrice - item.originalPrice) / item.originalPrice) * 100;
  }, [item.originalPrice, item.currentPrice]);

  const priceStatus = useMemo(() => {
    if (priceChangePercent < -10) return 'great-deal'; // >10% discount
    if (priceChangePercent < 0) return 'discount'; // Any discount
    if (priceChangePercent === 0) return 'unchanged';
    return 'increased';
  }, [priceChangePercent]);

  const recentTrend = useMemo(() => {
    if (item.priceHistory.length < 2) return 'stable';
    const sorted = [...item.priceHistory].sort((a, b) => b.date.getTime() - a.date.getTime());
    const latest = sorted[0]?.price || 0;
    const previous = sorted[1]?.price || 0;
    if (latest < previous) return 'decreasing';
    if (latest > previous) return 'increasing';
    return 'stable';
  }, [item.priceHistory]);

  const priceReachedTarget = useMemo(() => {
    return item.targetPrice ? item.currentPrice <= item.targetPrice : false;
  }, [item.currentPrice, item.targetPrice]);

  return {
    priceChangePercent,
    priceStatus,
    recentTrend,
    priceReachedTarget,
  };
};

const PriceAlertBadge: React.FC<{ status: ReturnType<typeof usePriceAlert>['priceStatus']; percent: number }> = ({
  status,
  percent,
}) => {
  const statusConfig = {
    'great-deal': { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Oferta!' },
    discount: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Rebajado' },
    unchanged: { bg: 'bg-[var(--bg-base)]', text: 'text-[var(--text-primary)]', label: 'Sin cambios' },
    increased: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Más caro' },
  };

  const config = statusConfig[status];
  const displayPercent = Math.abs(Math.round(percent));

  return (
    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
      {status === 'great-deal' || status === 'discount' ? (
        <TrendingDown size={14} />
      ) : status === 'increased' ? (
        <TrendingUp size={14} />
      ) : null}
      {config.label} {displayPercent > 0 && `${status === 'increased' ? '+' : '-'}${displayPercent}%`}
    </div>
  );
};

export const PriceAlert: React.FC<PriceAlertProps> = ({
  item,
  onNotificationToggle,
  onTargetPriceSet,
  compact = false,
}) => {
  const [showTargetInput, setShowTargetInput] = useState(false);
  const [targetInput, setTargetInput] = useState(item.targetPrice?.toString() || '');
  const { priceChangePercent, priceStatus, recentTrend, priceReachedTarget } = usePriceAlert(item);

  const handleSetTargetPrice = () => {
    const price = parseFloat(targetInput);
    if (!isNaN(price) && price > 0) {
      onTargetPriceSet?.(item.id, price);
      setShowTargetInput(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
        <div className="flex-1">
          <PriceAlertBadge status={priceStatus} percent={priceChangePercent} />
        </div>
        <button
          onClick={() => onNotificationToggle?.(item.id, !item.priceDropNotificationEnabled)}
          className={`p-2 rounded-lg transition-colors ${
            item.priceDropNotificationEnabled
              ? 'bg-amber-100 text-amber-600'
              : 'bg-[var(--bg-base)] text-[var(--text-secondary)]'
          }`}
          title={item.priceDropNotificationEnabled ? 'Alertas activas' : 'Activar alertas'}
        >
          {item.priceDropNotificationEnabled ? <Bell size={18} /> : <BellOff size={18} />}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border-light)]">
      {/* Price Status Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text-primary)]">Seguimiento de Precio</h3>
          <button
            onClick={() => onNotificationToggle?.(item.id, !item.priceDropNotificationEnabled)}
            className={`p-2 rounded-lg transition-colors ${
              item.priceDropNotificationEnabled
                ? 'bg-amber-100 text-amber-600'
                : 'bg-[var(--bg-base)] text-[var(--text-secondary)]'
            }`}
          >
            {item.priceDropNotificationEnabled ? <Bell size={20} /> : <BellOff size={20} />}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-[var(--bg-base)] rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Precio Actual</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">${item.currentPrice.toFixed(2)}</p>
          </div>
          <div className="text-center p-3 bg-[var(--bg-base)] rounded-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Precio Original</p>
            <p className="text-lg font-bold text-[var(--text-primary)]">${item.originalPrice.toFixed(2)}</p>
          </div>
        </div>

        <PriceAlertBadge status={priceStatus} percent={priceChangePercent} />
      </div>

      {/* Target Price Section */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-[var(--text-primary)]">Precio Objetivo</label>
          {priceReachedTarget && (
            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">
              ¡Alcanzado!
            </span>
          )}
        </div>

        {showTargetInput ? (
          <div className="flex gap-2">
            <input
              type="number"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="Ingresa precio objetivo"
              className="flex-1 px-3 py-2 border border-[var(--border-light)] rounded-lg focus:border-primary outline-none text-sm"
              min="0"
              step="0.01"
            />
            <button
              onClick={handleSetTargetPrice}
              className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors text-sm"
            >
              Guardar
            </button>
            <button
              onClick={() => setShowTargetInput(false)}
              className="px-4 py-2 bg-gray-200 text-[var(--text-primary)] font-semibold rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowTargetInput(true)}
            className="w-full px-3 py-2 border-2 border-dashed border-[var(--border-light)] rounded-lg text-sm text-[var(--text-secondary)] font-semibold hover:border-primary hover:text-primary transition-colors"
          >
            {item.targetPrice ? `Cambiar objetivo: $${item.targetPrice.toFixed(2)}` : 'Establecer precio objetivo'}
          </button>
        )}
      </div>

      {/* Price History Chart */}
      {item.priceHistory.length > 1 && (
        <div className="border-t pt-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-3">Historial Reciente</p>
          <div className="space-y-2">
            {item.priceHistory.slice(-5).reverse().map((point, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">{point.date.toLocaleDateString('es-ES')}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text-primary)]">${point.price.toFixed(2)}</span>
                  {idx > 0 && item.priceHistory[idx - 1] && (
                    <span className={`text-xs font-bold ${point.price < item.priceHistory[idx - 1].price ? 'text-emerald-600' : 'text-red-600'}`}>
                      {point.price < item.priceHistory[idx - 1].price ? '↓' : '↑'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
