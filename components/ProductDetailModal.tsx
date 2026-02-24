import React, { useState, useEffect } from 'react';
import { X, Share2, Heart, CreditCard, MessageCircle, Truck, Store, Copy, Send, Eye } from 'lucide-react';
import { useLanguage } from '../src/context/LanguageContext';

export interface ProductDisplayItem {
  id: string | number;
  title: string;
  price: number;
  image: string;
  user: string;
  avatar?: string;
  description?: string;
  brand?: string;
  size?: string;
  condition?: string;
  isOwnItem?: boolean;
}

interface ProductDetailModalProps {
  product: ProductDisplayItem;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onAddToTrip?: () => void;
  onMessage?: (product: ProductDisplayItem) => void;
  onShareFeed?: (product: ProductDisplayItem) => void;
  onSell?: (product: ProductDisplayItem) => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ product, onClose, onEdit, onDelete, onAddToTrip, onMessage, onShareFeed, onSell }) => {
  if (!product) return null;
  const { t } = useLanguage();
  const [showBuyOptions, setShowBuyOptions] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Load initial favorite status
  useEffect(() => {
    const loadFavoriteStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/social/favorites', {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        const favorites = await res.json();
        const isFavorited = Array.isArray(favorites) && favorites.some((fav: any) => fav && (fav.productId === product.id || fav.product?.id === product.id));
        setIsLiked(isFavorited);
      } catch (e) {
        console.warn('Failed to load favorite status:', e);
      }
    };
    loadFavoriteStatus();
  }, [product.id]);

  const galleryImages = [product.image];

  const handleShare = () => {
    setShowShareOptions(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLike = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/social/favorite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ productId: product.id })
      });
      const data = await res.json();
      setIsLiked(data.favorited || false);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Main Product Modal */}
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none p-4"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity duration-300"
          onClick={onClose}
        />

        {/* Main Modal Card */}
        <div
          className="bg-white w-full sm:max-w-md max-h-[90vh] rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden pointer-events-auto animate-pop-in transform transition-transform"
        >

          {/* Header with Close and Actions */}
          <div
            className="sticky top-0 z-20 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center"
          >
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={24} className="text-gray-600" />
            </button>

            <h3 className="text-sm font-bold text-gray-800">{t('details')}</h3>

            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
              >
                <Share2 size={20} />
              </button>
              <button
                onClick={handleLike}
                disabled={isLoading}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <Heart size={20} fill={isLiked ? "currentColor" : "none"} className={isLiked ? "text-rose-500" : "text-gray-600"} />
              </button>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">

            {/* Product Image Gallery */}
            <div className="w-full aspect-square bg-gray-100 relative overflow-hidden">
              <img src={product.image} className="w-full h-full object-cover" alt={product.title} />

              {/* Price Badge */}
              <div className="absolute top-4 right-4 bg-white rounded-xl px-3 py-2 shadow-md">
                <p className="text-xl font-bold text-primary">{product.price}€</p>
              </div>

              {/* Condition Badge */}
              {product.condition && (
                <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <p className="text-xs font-bold text-gray-700 capitalize">{t('state')}: {product.condition}</p>
                </div>
              )}
            </div>

            {/* Product Details */}
            <div className="px-6 py-4 space-y-4 pb-6">

              {/* Title and Brand */}
              <div>
                <h2 className="text-2xl font-bold text-gray-900 capitalize mb-1">{product.title}</h2>
                <p className="text-gray-600 font-medium">
                  {product.brand || t('unknownBrand')} {product.size ? `• ${t('sizeLabel')} ${product.size}` : ''}
                </p>
              </div>

              {/* Seller Info Card */}
              <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-4 border border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <img
                      src={product.avatar || "https://ui-avatars.com/api/?name=User&background=random"}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm flex-shrink-0"
                      alt={product.user}
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-gray-800 truncate">{product.user}</p>
                      <div className="flex text-yellow-400 text-xs">
                        {'★'.repeat(5)} <span className="text-gray-400 ml-1">(24 {t('reviews')})</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onMessage?.(product)}
                    className="p-2.5 rounded-full bg-white hover:bg-gray-50 transition-colors flex-shrink-0"
                  >
                    <MessageCircle size={18} className="text-primary" />
                  </button>
                </div>
                <p className="text-xs text-gray-600">{t('verifiedSeller')} • {t('fastDelivery')}</p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h3 className="font-bold text-gray-900">{t('description')}</h3>
                <div className="relative">
                  <p className={`text-gray-700 text-sm leading-relaxed ${!isDescExpanded ? 'line-clamp-3' : ''}`}>
                    {product.description || t('defaultDescription')}
                  </p>
                  {((product.description || t('defaultDescription')).length > 120) && (
                    <button
                      onClick={() => setIsDescExpanded(!isDescExpanded)}
                      className="text-primary text-xs font-bold mt-1 hover:underline inline-block"
                    >
                      {isDescExpanded ? 'Ver menos' : 'Ver más'}
                    </button>
                  )}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                {product.brand && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 font-semibold mb-1">{t('brandLabel')}</p>
                    <p className="text-sm font-bold text-gray-800">{product.brand}</p>
                  </div>
                )}
                {product.size && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 font-semibold mb-1">{t('sizeLabel')}</p>
                    <p className="text-sm font-bold text-gray-800">{product.size}</p>
                  </div>
                )}
                {product.condition && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-600 font-semibold mb-1">{t('state')}</p>
                    <p className="text-sm font-bold text-gray-800 capitalize">{product.condition}</p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-600 font-semibold mb-1">{t('shipping')}</p>
                  <p className="text-sm font-bold text-gray-800">3,95€</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Actions - Sticky */}
          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            {product.isOwnItem ? (
              /* Own Item Actions */
              <>
                <button
                  onClick={() => {
                    onAddToTrip?.();
                    onClose();
                  }}
                  className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl transition-all active:scale-[0.98]"
                >
                  ✈️ {t('addToSuitcase')}
                </button>
                {onSell && (
                  <button
                    onClick={() => {
                      onSell(product);
                      onClose();
                    }}
                    className="w-full bg-emerald-50 text-emerald-600 font-bold py-3 rounded-2xl border border-emerald-100 shadow-sm hover:bg-emerald-100 transition-all active:scale-[0.98]"
                  >
                    💰 {t('putOnSale')}
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      onEdit?.();
                      onClose();
                    }}
                    className="bg-blue-50 text-blue-600 font-bold py-2.5 rounded-xl hover:bg-blue-100 transition-colors active:scale-[0.98]"
                  >
                    {t('edit')}
                  </button>
                  <button
                    onClick={() => {
                      onDelete?.();
                      onClose();
                    }}
                    className="bg-red-50 text-red-600 font-bold py-2.5 rounded-xl hover:bg-red-100 transition-colors active:scale-[0.98]"
                  >
                    {t('deleteAction')}
                  </button>
                </div>
              </>
            ) : (
              /* Shop Item Actions */
              <>
                <button
                  onClick={() => setShowBuyOptions(true)}
                  className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 rounded-2xl shadow-lg shadow-primary/30 hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <CreditCard size={20} />
                  <span>{t('buyNow')}</span>
                </button>
                <button
                  onClick={() => onAddToTrip?.()}
                  className="w-full bg-blue-50 text-blue-600 font-bold py-2.5 rounded-xl hover:bg-blue-100 transition-colors active:scale-[0.98]"
                >
                  ✈️ {t('addToSuitcase')}
                </button>
              </>
            )}
          </div>
        </div>
      </div >

      {/* === SHARE OPTIONS OVERLAY (INDEPENDENT) === */}
      {
        showShareOptions && (
          <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto p-4 animate-fade-in"
          >
            <div
              className="bg-white w-full sm:max-w-md rounded-3xl p-6 animate-pop-in shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-bold text-gray-900">{t('shareItem')}</h3>
                <button
                  onClick={() => setShowShareOptions(false)}
                  className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>
              <p className="text-sm text-gray-600">{t('shareItemDesc')}</p>

              {/* Share Options */}
              <button
                onClick={() => {
                  onShareFeed?.(product);
                  setShowShareOptions(false);
                  onClose();
                }}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-2xl hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all group text-left"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-md group-hover:scale-110 group-hover:rotate-12 transition-transform flex-shrink-0">
                  <Eye size={28} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-base">{t('postOnSocial')}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{t('shareWithCommunity')}</p>
                </div>
                <span className="text-2xl group-hover:scale-110 transition-transform">📱</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-2xl hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all group text-left"
              >
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform flex-shrink-0">
                  <Copy size={28} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-base">{copied ? `✓ ${t('linkCopied')}` : t('copyLink')}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{t('shareViaMessaging')}</p>
                </div>
                <span className="text-2xl">📋</span>
              </button>

              {navigator.share && (
                <button
                  onClick={() => {
                    navigator.share({
                      title: product.title,
                      text: `Mira este ${product.title} en Estilovivo`,
                      url: window.location.href,
                    }).catch(console.error);
                    setShowShareOptions(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-2xl hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all group text-left"
                >
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform flex-shrink-0">
                    <Send size={28} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-base">{t('nativeShare')}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{t('nativeShareDesc')}</p>
                  </div>
                  <span className="text-2xl">📤</span>
                </button>
              )}

              <button
                onClick={() => setShowShareOptions(false)}
                className="w-full mt-2 py-3 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </div>
        )
      }

      {/* === BUY OPTIONS OVERLAY (INDEPENDENT) === */}
      {
        showBuyOptions && (
          <div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto p-4 animate-fade-in"
          >
            <div
              className="bg-white w-full sm:max-w-md rounded-3xl p-6 animate-pop-in shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">{t('chooseHowToBuy')}</h3>
                <button
                  onClick={() => setShowBuyOptions(false)}
                  className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X size={24} className="text-gray-600" />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <button className="w-full flex items-center p-4 border border-gray-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform flex-shrink-0">
                    <Store size={20} className="text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-gray-800">{t('inPerson')}</p>
                    <p className="text-xs text-gray-600">{t('meetWith')} {product.user.split(' ')[0]}</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-600">{t('free')}</span>
                </button>

                <button className="w-full flex items-center p-4 border border-gray-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all group">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mr-4 group-hover:scale-110 transition-transform flex-shrink-0">
                    <Truck size={20} className="text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-gray-800">{t('homeDelivery')}</p>
                    <p className="text-xs text-gray-600">{t('receiveIn')}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-800">3,95€</span>
                </button>
              </div>

              <button className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-[0.98]">
                {t('continueAction')}
              </button>
            </div>
          </div>
        )
      }
    </>
  );
};

export default ProductDetailModal;