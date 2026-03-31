import React, { useState, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Bookmark, MoreHorizontal, ShoppingBag, Search, Filter, Tag, Send, X, Shirt } from 'lucide-react';
import ProductDetailModal, { ProductDisplayItem } from '../components/ProductDetailModal';
import { api } from '../services/api';
import { Look, UserState, ShopItem, Comment } from '../types';
import { useLanguage } from '../src/context/LanguageContext';

interface CommunityProps {
    user: UserState;
    onNavigate: (tab: string) => void;
}

const Community: React.FC<CommunityProps> = ({ user, onNavigate }) => {
    const [activeTab, setActiveTab] = useState<'feed' | 'shop'>('feed');
    const [selectedItem, setSelectedItem] = useState<ProductDisplayItem | null>(null);
    const [feedLooks, setFeedLooks] = useState<Look[]>([]);
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [favoritedProductIds, setFavoritedProductIds] = useState<Set<string>>(new Set());

    // Comments modal
    const [commentsLookId, setCommentsLookId] = useState<string | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentInput, setCommentInput] = useState('');
    const [loadingComments, setLoadingComments] = useState(false);

    const loadFeed = useCallback(async () => {
        setIsLoading(true);
        try {
            const looks = await api.getCommunityFeed();
            setFeedLooks(looks);
        } catch (error) {
            console.error("Error loading feed:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const loadShop = useCallback(async () => {
        setIsLoading(true);
        try {
            const items = await api.getShopProducts(searchQuery || undefined);
            setShopItems(items);
        } catch (error) {
            console.error("Error loading shop:", error);
        } finally {
            setIsLoading(false);
        }
    }, [searchQuery]);

    const loadFavorites = useCallback(async () => {
        try {
            const favs = await api.getFavorites();
            const ids = new Set<string>();
            favs.forEach((f: any) => {
                const id = f.productId || f.product?.id;
                if (id) ids.add(id);
            });
            setFavoritedProductIds(ids);
        } catch (error) {
            console.warn("Error loading favorites:", error);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'feed') loadFeed();
        else {
            loadShop();
            loadFavorites();
        }
    }, [activeTab, loadFeed, loadShop, loadFavorites]);

    const handleToggleLike = async (lookId: string) => {
        try {
            const result = await api.toggleLike(lookId);
            setFeedLooks(prev => prev.map(l => {
                if (l.id === lookId) {
                    return { ...l, isLiked: result.liked, likesCount: result.likesCount };
                }
                return l;
            }));
        } catch (error) {
            console.error("Error toggling like:", error);
        }
    };

    const handleToggleFavorite = async (lookId: string) => {
        try {
            const result = await api.toggleFavorite(lookId);
            setFeedLooks(prev => prev.map(l => {
                if (l.id === lookId) {
                    return { ...l, isFavorited: result.favorited };
                }
                return l;
            }));
        } catch (error) {
            console.error("Error toggling favorite:", error);
        }
    };

    const handleToggleProductFavorite = async (productId: string) => {
        try {
            const result = await api.toggleFavorite(undefined, productId);
            setFavoritedProductIds(prev => {
                const next = new Set(prev);
                if (result.favorited) next.add(productId);
                else next.delete(productId);
                return next;
            });
        } catch (error) {
            console.error("Error toggling product favorite:", error);
        }
    };

    const openComments = async (lookId: string) => {
        setCommentsLookId(lookId);
        setLoadingComments(true);
        try {
            const data = await api.getComments(lookId);
            setComments(data);
        } catch (error) {
            console.error("Error loading comments:", error);
        } finally {
            setLoadingComments(false);
        }
    };

    const handleSendComment = async () => {
        if (!commentInput.trim() || !commentsLookId) return;
        try {
            const newComment = await api.addComment(commentsLookId, commentInput.trim());
            setComments(prev => [newComment, ...prev]);
            setCommentInput('');
            // Update count in feed
            setFeedLooks(prev => prev.map(l => {
                if (l.id === commentsLookId) {
                    return { ...l, commentsCount: (l.commentsCount || 0) + 1 };
                }
                return l;
            }));
        } catch (error) {
            console.error("Error sending comment:", error);
        }
    };

  const currentUserId = localStorage.getItem('beyour_user') ? JSON.parse(localStorage.getItem('beyour_user') || '{}').id : null;

  const handleItemClick = (item: ShopItem) => {
    setSelectedItem({
      id: item.id,
      title: item.title,
      price: item.price,
      image: item.image,
      user: item.user,
      avatar: item.avatar,
      brand: item.brand,
      size: item.size,
      isOwnItem: item.userId === currentUserId || (item as any).user?.id === currentUserId
    });
  };

    const handleStartChat = async (item?: ShopItem) => {
        if (!item) {
            onNavigate('chat');
            return;
        }
        try {
            const res = await api.createConversation({
                targetUserId: item.userId,
                itemId: item.id,
                itemTitle: item.title,
                itemImage: item.image,
                initialMessage: `Hola, me interesa "${item.title}". ¿Sigue disponible?`
            });
            localStorage.setItem('ev_chat_open', res.id);
        } catch (e) {
            console.warn('Could not create conversation:', e);
            localStorage.setItem('ev_chat_draft', JSON.stringify({
                user: item.user,
                avatar: item.avatar,
                itemTitle: item.title,
                itemId: item.id,
                targetUserId: item.userId,
                itemImage: item.image,
                message: `Hola, me interesa "${item.title}". ¿Sigue disponible?`
            }));
        }
        onNavigate('chat');
    };

    const getLookImage = (look: Look) => {
        if (look.imageUrl) return look.imageUrl;
        if (look.garments && look.garments.length > 0) return look.garments[0].imageUrl;
        return null;
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        loadShop();
    };

    const { t } = useLanguage();

    return (
        <div className="pb-24 bg-gray-50 min-h-full">
            {/* Header with Tabs */}
            <div className="bg-white p-5 rounded-b-3xl shadow-sm mb-6 sticky top-0 z-10">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-800">{t('social')}</h1>
                    <div className="flex bg-gray-100 rounded-full p-1">
                        <button
                            onClick={() => setActiveTab('feed')}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === 'feed' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                        >
                            Inspiración
                        </button>
                        <button
                            onClick={() => setActiveTab('shop')}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === 'shop' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                        >
                            {t('forSale')}
                        </button>
                    </div>
                </div>

                {activeTab === 'feed' && (
                    <div className="bg-gradient-to-r from-primary to-teal-800 rounded-2xl p-4 text-white relative overflow-hidden animate-fade-in">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
                        <span className="inline-block px-2 py-1 bg-accent text-[10px] font-bold uppercase tracking-wider rounded-md mb-2">Reto Semanal</span>
                        <h3 className="font-bold text-lg mb-1">Color Block</h3>
                        <p className="text-sm text-teal-100 opacity-90 mb-3">Combina colores vibrantes y gana visibilidad en la tienda.</p>
                        <button className="text-xs font-semibold bg-white text-primary px-3 py-1.5 rounded-full">Participar</button>
                    </div>
                )}

                {activeTab === 'shop' && (
                    <form onSubmit={handleSearchSubmit} className="flex space-x-2 animate-fade-in">
                        <div className="flex-1 bg-gray-100 rounded-xl px-3 py-2 flex items-center text-gray-400">
                            <Search size={16} className="mr-2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Buscar prendas..."
                                className="bg-transparent border-none outline-none text-sm w-full text-gray-700"
                            />
                        </div>
                        <button type="submit" className="bg-primary text-white p-2 rounded-xl">
                            <Search size={20} />
                        </button>
                    </form>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-20">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* --- FEED --- */}
                    {activeTab === 'feed' && (
                        <div className="space-y-6 px-4">
                            {feedLooks.map(post => {
                                const postImage = getLookImage(post);
                                return (
                                    <div key={post.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in-up">
                                        <div className="p-4 flex justify-between items-center">
                                            <div className="flex items-center space-x-3">
                                                <img
                                                    src={post.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.userName || 'U')}&background=0F4C5C&color=fff`}
                                                    className="w-10 h-10 rounded-full object-cover border border-gray-100"
                                                    alt={post.userName}
                                                />
                                                <div>
                                                    <h4 className="font-bold text-sm text-gray-800">{post.userName || 'Usuario'}</h4>
                                                    {post.mood && (
                                                        <div className="flex items-center space-x-1">
                                                            <div className="w-2 h-2 rounded-full bg-accent" />
                                                            <span className="text-xs text-gray-500">{post.mood}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button className="text-gray-400">
                                                <MoreHorizontal size={20} />
                                            </button>
                                        </div>

                                        {postImage ? (
                                            <div className="aspect-[4/5] bg-gray-100 relative">
                                                <img src={postImage} className="w-full h-full object-cover" loading="lazy" alt={post.name} />
                                            </div>
                                        ) : (
                                            <div className="aspect-[4/5] bg-gray-50 flex items-center justify-center">
                                                <div className="text-center opacity-40">
                                                    <Shirt size={48} className="mx-auto mb-2 text-gray-400" />
                                                    <p className="text-sm text-gray-500">{post.name}</p>
                                                    {post.garments && post.garments.length > 0 && (
                                                        <div className="flex justify-center mt-3 space-x-2">
                                                            {post.garments.slice(0, 4).map(g => (
                                                                <img key={g.id} src={g.imageUrl} className="w-16 h-16 rounded-lg object-cover" alt={g.type} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex space-x-4">
                                                    <button
                                                        onClick={() => handleToggleLike(post.id)}
                                                        className={`flex items-center space-x-1 transition-colors ${post.isLiked ? 'text-rose-500' : 'text-gray-600 hover:text-rose-500'}`}
                                                    >
                                                        <Heart size={24} fill={post.isLiked ? "currentColor" : "none"} />
                                                        <span className="text-xs font-bold">{post.likesCount || 0}</span>
                                                    </button>
                                                    <button
                                                        onClick={() => openComments(post.id)}
                                                        className="flex items-center space-x-1 text-gray-600 hover:text-blue-500 transition-colors"
                                                    >
                                                        <MessageCircle size={24} />
                                                        <span className="text-xs font-bold">{post.commentsCount || 0}</span>
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleFavorite(post.id)}
                                                    className={`transition-colors ${post.isFavorited ? 'text-amber-500' : 'text-gray-600 hover:text-amber-500'}`}
                                                >
                                                    <Bookmark size={24} fill={post.isFavorited ? "currentColor" : "none"} />
                                                </button>
                                            </div>
                                            <p className="text-sm text-gray-700 leading-relaxed">
                                                <span className="font-bold mr-1">{post.userName || 'Usuario'}</span>
                                                {post.name}
                                            </p>
                                            {post.tags && post.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {post.tags.map(tag => (
                                                        <span key={tag} className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">#{tag}</span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {feedLooks.length === 0 && (
                                <div className="text-center py-20 text-gray-400">
                                    <Shirt size={48} className="mx-auto mb-3 text-gray-300" />
                                    <p className="font-medium">Aún no hay looks compartidos</p>
                                    <p className="text-sm mt-1">Sé el primero en compartir un look público.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* --- SHOP --- */}
                    {activeTab === 'shop' && (
                        <div className="px-4 pb-4 animate-fade-in">
                            <div className="grid grid-cols-2 gap-4">
                                {shopItems.map((item) => (
                                    <div
                                        key={item.id}
                                        className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative group cursor-pointer"
                                        onClick={() => handleItemClick(item)}
                                    >
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleToggleProductFavorite(item.id); }}
                                            className={`absolute top-2 left-2 z-10 p-1.5 rounded-full shadow-sm ${favoritedProductIds.has(item.id)
                                                ? 'bg-amber-500 text-white'
                                                : 'bg-white text-gray-500'
                                                }`}
                                        >
                                            <Bookmark size={14} fill={favoritedProductIds.has(item.id) ? 'currentColor' : 'none'} />
                                        </button>
                                        <div className="absolute top-2 right-2 z-10 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                                            {item.price}€
                                        </div>

                                        <div className="aspect-square bg-gray-50 relative">
                                            <img src={item.image} className="w-full h-full object-cover" loading="lazy" alt={item.title} />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button className="bg-white text-primary px-3 py-1.5 rounded-full text-xs font-bold flex items-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                                    <ShoppingBag size={12} className="mr-1" /> Ver
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-3">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-xs font-bold text-gray-700 capitalize line-clamp-1">{item.title}</p>
                                            </div>
                                            <div className="flex items-center text-[10px] text-gray-400 mb-2">
                                                <Tag size={10} className="mr-1" />
                                                <span>{item.brand} {item.size !== 'Única' ? `• Talla ${item.size}` : ''}</span>
                                            </div>
                                            <div className="flex items-center pt-2 border-t border-gray-50">
                                                <img src={item.avatar} className="w-5 h-5 rounded-full object-cover border border-gray-100 mr-1.5" alt={item.user} />
                                                <span className="text-[10px] text-gray-500 truncate">{item.user}</span>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleStartChat(item); }}
                                                    className="ml-auto text-[10px] text-primary font-semibold"
                                                >
                                                    Chatear
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {shopItems.length === 0 && (
                                    <div className="col-span-2 text-center py-20 text-gray-400">
                                        <ShoppingBag size={48} className="mx-auto mb-3 text-gray-300" />
                                        <p className="font-medium">No hay artículos a la venta</p>
                                        <p className="text-sm mt-1">Vuelve más tarde o prueba otra búsqueda.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Comments Modal */}
            {commentsLookId && (
                <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center">
                    <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl animate-fade-in-up h-[70vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100">
                            <h3 className="font-bold text-gray-800">Comentarios</h3>
                            <button onClick={() => { setCommentsLookId(null); setComments([]); }}>
                                <X size={24} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                            {loadingComments ? (
                                <div className="flex justify-center py-10">
                                    <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                </div>
                            ) : comments.length === 0 ? (
                                <p className="text-center text-gray-400 py-10">Sé el primero en comentar</p>
                            ) : (
                                comments.map(c => (
                                    <div key={c.id} className="flex space-x-3">
                                        <img
                                            src={c.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.userName)}&background=0F4C5C&color=fff`}
                                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                            alt={c.userName}
                                        />
                                        <div>
                                            <p className="text-sm">
                                                <span className="font-bold text-gray-800 mr-1">{c.userName}</span>
                                                <span className="text-gray-600">{c.content}</span>
                                            </p>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(c.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t border-gray-100 flex items-center space-x-3">
                            <img
                                src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=0F4C5C&color=fff`}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                alt="You"
                            />
                            <div className="flex-1 flex items-center bg-gray-100 rounded-full px-4 py-2">
                                <input
                                    type="text"
                                    value={commentInput}
                                    onChange={e => setCommentInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendComment()}
                                    placeholder="Añade un comentario..."
                                    className="flex-1 bg-transparent text-sm outline-none"
                                />
                                <button
                                    onClick={handleSendComment}
                                    disabled={!commentInput.trim()}
                                    className="text-primary disabled:text-gray-300 ml-2"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {selectedItem && (
                <ProductDetailModal
                    product={selectedItem}
                    onClose={() => setSelectedItem(null)}
                    onMessage={() => {
                        const item = shopItems.find(s => s.id === selectedItem.id);
                        handleStartChat(item);
                    }}
                />
            )}
        </div>
    );
};

export default Community;
