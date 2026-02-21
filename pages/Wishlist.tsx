import React, { useEffect, useMemo, useState } from 'react';
import { Heart, Tag, Sparkles, ShoppingBag, MessageCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { Garment } from '../types';
import { useLanguage } from '../src/context/LanguageContext';

interface WishlistProps {
  garments: Garment[];
  onNavigate: (tab: string) => void;
}

const Wishlist: React.FC<WishlistProps> = ({ garments, onNavigate }) => {
  const { t } = useLanguage();
  const [favorites, setFavorites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.getFavorites();
        if (isMounted) setFavorites(data);
      } catch (e) {
        console.warn('Could not load favorites:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const garmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    garments.forEach(g => {
      if (g.type) counts[g.type] = (counts[g.type] || 0) + 1;
      if (g.color) counts[g.color.toLowerCase()] = (counts[g.color.toLowerCase()] || 0) + 1;
    });
    return counts;
  }, [garments]);

  const getCompatibilityLabel = (product: any) => {
    const typeKey = product?.category;
    const colorKey = (product?.color || '').toLowerCase();
    const score = (typeKey ? garmentCounts[typeKey] || 0 : 0) + (colorKey ? garmentCounts[colorKey] || 0 : 0);
    if (score >= 6) return t('combinations6');
    if (score >= 3) return t('combinations3');
    if (score >= 1) return t('combinations1');
    return t('noCombinations');
  };

  const handleRemove = async (fav: any) => {
    try {
      await api.toggleFavorite(fav.lookId || fav.look?.id, fav.productId || fav.product?.id);
      setFavorites(prev => prev.filter(f => f.id !== fav.id));
    } catch (e) {
      console.warn('Error removing favorite:', e);
    }
  };

  const handleMoveToWardrobe = async (fav: any) => {
    const product = fav.product;
    if (!product) return;
    setActionLoadingId(fav.id);
    try {
      await api.addGarment({
        name: product.name,
        category: product.category || 'top',
        color: product.color || 'varios',
        season: product.season || 'all',
        brand: product.brand || undefined,
        size: product.size || undefined,
      });
      await api.toggleFavorite(undefined, product.id);
      setFavorites(prev => prev.filter(f => f.id !== fav.id));
      onNavigate('wardrobe');
    } catch (e) {
      console.warn('Error moving to wardrobe:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkPurchased = async (fav: any) => {
    setActionLoadingId(fav.id);
    try {
      await api.toggleFavorite(fav.lookId || fav.look?.id, fav.productId || fav.product?.id);
      setFavorites(prev => prev.filter(f => f.id !== fav.id));
    } catch (e) {
      console.warn('Error marking purchased:', e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartChat = async (product: any) => {
    try {
      const res = await api.createConversation({
        targetUserId: product.user?.id,
        itemId: product.id,
        itemTitle: product.name,
        itemImage: product.imageUrl || product.images?.[0]?.url,
        initialMessage: `Hola, me interesa "${product.name}". ¿Sigue disponible?`
      });
      localStorage.setItem('ev_chat_open', res.id);
    } catch (e) {
      console.warn('Could not create conversation:', e);
      localStorage.setItem('ev_chat_draft', JSON.stringify({
        user: product.user?.name || 'Vendedor',
        avatar: product.user?.avatar,
        itemTitle: product.name,
        itemId: product.id,
        targetUserId: product.user?.id,
        itemImage: product.imageUrl || product.images?.[0]?.url,
        message: `Hola, me interesa "${product.name}". ¿Sigue disponible?`
      }));
    }
    onNavigate('chat');
  };

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-full">
      <header className="flex justify-between items-center mb-6 mt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('wishlist')}</h1>
          <p className="text-sm text-gray-500">{favorites.length} {t('savedItems')}</p>
        </div>
        <button
          onClick={() => onNavigate('community')}
          className="text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full"
        >
          {t('explore')}
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-16">
          <Heart size={48} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">{t('noWishlist')}</p>
          <p className="text-xs text-gray-300 mt-1">{t('noWishlistDesc')}</p>
          <button
            onClick={() => onNavigate('community')}
            className="mt-4 text-primary text-sm font-medium"
          >
            {t('goToCommunity')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
          {favorites.map((fav: any) => (
            <div key={fav.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {fav.look && (
                <>
                  <div className="aspect-[3/4] bg-gray-100 relative">
                    {fav.look.imageUrl || (fav.look.garments && fav.look.garments[0]?.imageUrl) ? (
                      <img
                        src={fav.look.imageUrl || fav.look.garments[0].imageUrl}
                        alt={fav.look.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Sparkles size={28} />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1">
                      <Heart size={14} className="text-rose-500 fill-rose-500" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-800 truncate">{fav.look.name}</p>
                    <p className="text-xs text-gray-400">Look guardado</p>
                    <button
                      onClick={() => handleRemove(fav)}
                      className="mt-2 text-[10px] text-rose-500 font-semibold"
                    >
                      {t('removeFromWishlist')}
                    </button>
                  </div>
                </>
              )}

              {fav.product && (
                <>
                  <div className="aspect-[3/4] bg-gray-100 relative">
                    {fav.product.imageUrl || fav.product.images?.[0]?.url ? (
                      <img
                        src={fav.product.imageUrl || fav.product.images?.[0]?.url}
                        alt={fav.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ShoppingBag size={28} />
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-white/90 rounded-full p-1">
                      <Tag size={14} className="text-primary" />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-800 truncate">{fav.product.name}</p>
                    <p className="text-xs text-gray-400">{getCompatibilityLabel(fav.product)}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleMoveToWardrobe(fav)}
                        disabled={actionLoadingId === fav.id}
                        className="text-[10px] font-semibold text-white bg-primary px-2.5 py-1 rounded-full disabled:opacity-60"
                      >
                        {actionLoadingId === fav.id ? t('movingToWardrobe') : t('moveToWardrobe')}
                      </button>
                      <button
                        onClick={() => handleMarkPurchased(fav)}
                        disabled={actionLoadingId === fav.id}
                        className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full disabled:opacity-60"
                      >
                        <CheckCircle2 size={12} className="inline-block mr-1" /> {t('purchased')}
                      </button>
                    </div>
                    <button
                      onClick={() => handleStartChat(fav.product)}
                      className="mt-2 text-[10px] text-primary font-semibold inline-flex items-center gap-1"
                    >
                      <MessageCircle size={12} /> {t('askSeller')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
