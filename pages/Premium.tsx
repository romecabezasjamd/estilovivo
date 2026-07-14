import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, Crown, Sparkles, Shield, Zap } from 'lucide-react';
import { initBilling, getProducts, purchaseProduct, restorePurchases, checkPremiumStatus, PRODUCT_IDS } from '../src/utils/billing';
import { analytics } from '../src/utils/firebase';
import { successImpact, errorImpact } from '../src/utils/haptic';

interface Props {
  onBack: () => void;
}

const FEATURES = [
  { icon: <Zap size={18} />, title: 'Probador virtual ilimitado', desc: 'Prueba prendas sin límites diarios' },
  { icon: <Sparkles size={18} />, title: 'Ventas ilimitadas', desc: 'Publica todas las prendas que quieras a la venta' },
  { icon: <Shield size={18} />, title: 'Sin anuncios', desc: 'Experiencia limpia sin interrupciones' },
  { icon: <Crown size={18} />, title: 'Soporte prioritario', desc: 'Respuesta en menos de 24 horas' },
];

export default function Premium({ onBack }: Props) {
  const [products, setProducts] = useState<any[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await initBilling();
      const prods = await getProducts();
      setProducts(prods);
      const premium = await checkPremiumStatus();
      setIsPremium(premium);
      setLoading(false);
    })();
  }, []);

  const handlePurchase = async (productId: string) => {
    setPurchasing(productId);
    try {
      const result = await purchaseProduct(productId);
      if (result) {
        setIsPremium(true);
        analytics.logEvent('premium_purchase', { product_id: productId });
        successImpact();
      }
    } catch {
      errorImpact();
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    await restorePurchases();
    const premium = await checkPremiumStatus();
    setIsPremium(premium);
    setLoading(false);
  };

  const getProduct = (id: string) => products.find(p => p.id === id);

  if (isPremium) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)]">
        <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
          <button onClick={onBack} className="p-1 rounded-lg"><ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} /></button>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Estilo Vivo Premium</h1>
        </div>
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <div className="w-20 h-20 rounded-3xl bg-yellow-500/10 flex items-center justify-center mb-6">
            <Crown size={40} className="text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Ya eres Premium</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Disfruta de todos los beneficios exclusivos</p>
          <button onClick={onBack} className="px-6 py-3 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: 'var(--border-light)' }}>
        <button onClick={onBack} className="p-1 rounded-lg"><ArrowLeft size={20} style={{ color: 'var(--text-primary)' }} /></button>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Estilo Vivo Premium</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Crown size={32} className="text-white" />
          </div>
          <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Desbloquea todo el potencial</h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Lleva tu estilo al siguiente nivel</p>
        </div>

        <div className="space-y-3">
          {FEATURES.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-primary)', color: 'white' }}>
                {f.icon}
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{f.title}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {[
            { id: PRODUCT_IDS.PREMIUM_MONTHLY, label: 'Mensual', period: '/mes', price: '2,99 €' },
            { id: PRODUCT_IDS.PREMIUM_YEARLY, label: 'Anual', period: '/año', price: '30 €', badge: 'Ahorra 16%' },
          ].map(plan => {
            const prod = getProduct(plan.id);
            return (
              <button
                key={plan.id}
                onClick={() => handlePurchase(plan.id)}
                disabled={purchasing !== null}
                className="w-full p-4 rounded-xl text-left relative overflow-hidden"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: `2px solid ${purchasing === plan.id ? 'var(--color-primary)' : 'var(--border-light)'}`,
                }}
              >
                {plan.badge && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[8px] font-bold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                    {plan.badge}
                  </span>
                )}
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{plan.label}</p>
                <p className="text-lg font-black mt-1" style={{ color: 'var(--color-primary)' }}>
                  {plan.price} <span className="text-[10px] font-normal" style={{ color: 'var(--text-muted)' }}>{plan.period}</span>
                </p>
                {purchasing === plan.id && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <button onClick={handleRestore} className="w-full py-3 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Restaurar compras
        </button>
      </div>
    </div>
  );
}
