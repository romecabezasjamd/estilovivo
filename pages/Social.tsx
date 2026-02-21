import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Heart, MessageCircle, Bookmark, MoreHorizontal, ShoppingBag, Search, Tag, Send, X, Shirt, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import ProductDetailModal, { ProductDisplayItem } from '../components/ProductDetailModal';
import { api } from '../services/api';
import { Look, UserState, ShopItem, Comment, Garment, ChatConversation, ChatMessage } from '../types';
import { useLanguage } from '../src/context/LanguageContext';

interface SocialProps {
  user: UserState;
  garments: Garment[];
  onNavigate: (tab: string) => void;
}

const Social: React.FC<SocialProps> = ({ user, garments, onNavigate }) => {
  // Main tabs: 'feed', 'shop', 'favorites', 'chat'
  const [activeTab, setActiveTab] = useState<'feed' | 'shop' | 'favorites' | 'chat'>('feed');

  // Community Feed & Shop
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

  // Favorites (Wishlist)
  const [favorites, setFavorites] = useState<any[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Chat
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messagesById, setMessagesById] = useState<Record<string, ChatMessage[]>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const currentUserId = useMemo(() => {
    const raw = localStorage.getItem('beyour_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw).id || null;
    } catch {
      return null;
    }
  }, []);

  const { t } = useLanguage();

  // === DATA LOADING ===
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
    setIsLoading(true);
    try {
      const data = await api.getFavorites();
      setFavorites(data);

      // Also load favorited product IDs for shop tab
      const ids = new Set<string>();
      data.forEach((f: any) => {
        const id = f.productId || f.product?.id;
        if (id) ids.add(id);
      });
      setFavoritedProductIds(ids);
    } catch (e) {
      console.warn('Could not load favorites:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    const draftRaw = localStorage.getItem('ev_chat_draft');
    const openId = localStorage.getItem('ev_chat_open');

    setLoadingConversations(true);
    try {
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        if (draft.targetUserId) {
          const created = await api.createConversation({
            targetUserId: draft.targetUserId,
            itemId: draft.itemId,
            itemTitle: draft.itemTitle,
            itemImage: draft.itemImage,
            initialMessage: draft.message,
          });
          localStorage.setItem('ev_chat_open', created.id);
        }
        localStorage.removeItem('ev_chat_draft');
      }

      const data = await api.getConversations();
      setConversations(data);
      const nextId = openId || data[0]?.id || null;
      if (nextId) setSelectedThreadId(nextId);
    } catch (e) {
      console.warn('Error loading conversations:', e);
    } finally {
      setLoadingConversations(false);
      localStorage.removeItem('ev_chat_open');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'feed') loadFeed();
    else if (activeTab === 'shop') {
      loadShop();
      loadFavorites();
    }
    else if (activeTab === 'favorites') loadFavorites();
    else if (activeTab === 'chat') loadConversations();
  }, [activeTab, loadFeed, loadShop, loadFavorites, loadConversations]);

  // === FEED HANDLERS ===
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

  const handleShareFeed = async (product: ProductDisplayItem) => {
    try {
      // Create a public look from the product
      const newLook: Look = {
        id: '',
        name: product.title,
        garmentIds: [String(product.id)],
        isPublic: true,
        mood: 'Compartido desde tienda',
        tags: ['compartido'],
        createdAt: new Date().toISOString(),
      };

      const savedLook = await api.saveLook(newLook);

      // Add to feed immediately
      setFeedLooks(prev => [savedLook, ...prev]);

      // Close the modal
      setSelectedItem(null);

      // Show success message
      console.log('✓ Producto compartido en el feed');
    } catch (error) {
      console.error('Error sharing product to feed:', error);
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

  // === SHOP HANDLERS ===
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

  const handleItemClick = (item: ShopItem) => {
    setSelectedItem({
      id: item.id,
      title: item.title,
      price: item.price,
      image: item.image,
      user: item.user,
      avatar: item.avatar,
      brand: item.brand,
      size: item.size
    });
  };

  const handleStartChat = async (item?: ShopItem, product?: any) => {
    const targetItem = item || product;
    if (!targetItem) {
      setActiveTab('chat');
      return;
    }

    try {
      const res = await api.createConversation({
        targetUserId: targetItem.userId || targetItem.user?.id,
        itemId: targetItem.id,
        itemTitle: targetItem.title || targetItem.name,
        itemImage: targetItem.image || targetItem.imageUrl || targetItem.images?.[0]?.url,
        initialMessage: `Hola, me interesa "${targetItem.title || targetItem.name}". ¿Sigue disponible?`
      });
      localStorage.setItem('ev_chat_open', res.id);
    } catch (e) {
      console.warn('Could not create conversation:', e);
      localStorage.setItem('ev_chat_draft', JSON.stringify({
        user: targetItem.user?.name || targetItem.user || 'Vendedor',
        avatar: targetItem.avatar || targetItem.user?.avatar,
        itemTitle: targetItem.title || targetItem.name,
        itemId: targetItem.id,
        targetUserId: targetItem.userId || targetItem.user?.id,
        itemImage: targetItem.image || targetItem.imageUrl || targetItem.images?.[0]?.url,
        message: `Hola, me interesa "${targetItem.title || targetItem.name}". ¿Sigue disponible?`
      }));
    }
    setActiveTab('chat');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadShop();
  };

  // === FAVORITES (WISHLIST) HANDLERS ===
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
    if (score >= 6) return 'Combina con 6+ prendas';
    if (score >= 3) return 'Combina con 3+ prendas';
    if (score >= 1) return 'Combina con tu armario';
    return 'Sin combinaciones claras';
  };

  const handleRemoveFavorite = async (fav: any) => {
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

  // === CHAT HANDLERS ===
  const activeThread = useMemo(
    () => conversations.find(t => t.id === selectedThreadId) || null,
    [conversations, selectedThreadId]
  );

  useEffect(() => {
    const loadMessages = async () => {
      if (!selectedThreadId) return;
      if (messagesById[selectedThreadId]) return;
      setLoadingMessages(true);
      try {
        const data = await api.getConversationMessages(selectedThreadId);
        setMessagesById(prev => ({ ...prev, [selectedThreadId]: data }));
      } catch (e) {
        console.warn('Error loading messages:', e);
      } finally {
        setLoadingMessages(false);
      }
    };
    loadMessages();
  }, [selectedThreadId, messagesById]);

  const handleChatSend = () => {
    if (!messageInput.trim() || !activeThread) return;
    const content = messageInput.trim();
    setMessageInput('');

    api.sendConversationMessage(activeThread.id, content)
      .then((message) => {
        setMessagesById(prev => ({
          ...prev,
          [activeThread.id]: [...(prev[activeThread.id] || []), message]
        }));
        setConversations(prev => prev.map(c => c.id === activeThread.id
          ? {
            ...c,
            updatedAt: message.createdAt,
            lastMessage: {
              id: message.id,
              content: message.content,
              createdAt: message.createdAt,
              sender: message.sender
            }
          }
          : c
        ));
      })
      .catch((e) => {
        console.warn('Error sending message:', e);
      });
  };

  // === UTILS ===
  const getLookImage = (look: Look) => {
    if (look.imageUrl) return look.imageUrl;
    if (look.garments && look.garments.length > 0) return look.garments[0].imageUrl;
    return null;
  };

  // === RENDER ===
  return (
    <div className="pb-24 bg-gray-50 min-h-full">
      {/* Header with Main Tabs */}
      <div className="bg-white p-5 rounded-b-3xl shadow-sm mb-6 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Social</h1>
        </div>

        <div className="flex bg-gray-100 rounded-full p-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'feed' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            Feed
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'shop' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            Tienda
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'favorites' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            Favoritos
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeTab === 'chat' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            Chat
          </button>
        </div>

        {/* Sub-headers per tab */}
        {activeTab === 'feed' && (
          <div className="bg-gradient-to-r from-primary to-teal-800 rounded-2xl p-4 text-white relative overflow-hidden animate-fade-in mt-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
            <span className="inline-block px-2 py-1 bg-accent text-[10px] font-bold uppercase tracking-wider rounded-md mb-2">Reto Semanal</span>
            <h3 className="font-bold text-lg mb-1">Color Block</h3>
            <p className="text-sm text-teal-100 opacity-90 mb-3">Combina colores vibrantes y gana visibilidad en la tienda.</p>
            <button className="text-xs font-semibold bg-white text-primary px-3 py-1.5 rounded-full">Participar</button>
          </div>
        )}

        {activeTab === 'shop' && (
          <form onSubmit={handleSearchSubmit} className="flex space-x-2 animate-fade-in mt-4">
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

      {/* Content Area */}
      {isLoading || (activeTab === 'chat' && loadingConversations) ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* FEED TAB */}
          {activeTab === 'feed' && (
            <div className="space-y-6 px-4">
              {feedLooks.map(post => {
                const postImage = getLookImage(post);
                return (
                  <div key={post.id} className="stagger-child bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-primary/30 transition-all">
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

          {/* SHOP TAB */}
          {activeTab === 'shop' && (
            <div className="px-4 pb-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                {shopItems.map((item) => (
                  <div
                    key={item.id}
                    className="stagger-child bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 relative group cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
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

          {/* FAVORITES TAB */}
          {activeTab === 'favorites' && (
            <div className="px-6 animate-fade-in">
              {favorites.length === 0 ? (
                <div className="text-center py-16">
                  <Heart size={48} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-gray-400 text-sm">Aun no tienes favoritos</p>
                  <p className="text-xs text-gray-300 mt-1">Guarda prendas o looks que te inspiren</p>
                  <button
                    onClick={() => setActiveTab('feed')}
                    className="mt-4 text-primary text-sm font-medium"
                  >
                    Explorar Feed
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {favorites.map((fav: any) => (
                    <div key={fav.id} className="stagger-child bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-primary/30 transition-all">
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
                              onClick={() => handleRemoveFavorite(fav)}
                              className="mt-2 text-[10px] text-rose-500 font-semibold"
                            >
                              Quitar
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
                                {actionLoadingId === fav.id ? 'Guardando...' : 'Mover a armario'}
                              </button>
                              <button
                                onClick={() => handleMarkPurchased(fav)}
                                disabled={actionLoadingId === fav.id}
                                className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full disabled:opacity-60"
                              >
                                <CheckCircle2 size={12} className="inline-block mr-1" /> Comprada
                              </button>
                            </div>
                            <button
                              onClick={() => handleStartChat(undefined, fav.product)}
                              className="mt-2 text-[10px] text-primary font-semibold inline-flex items-center gap-1"
                            >
                              <MessageCircle size={12} /> Preguntar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CHAT TAB */}
          {activeTab === 'chat' && (
            <div className="px-6 animate-fade-in">
              {conversations.length === 0 ? (
                <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center shadow-sm">
                  <MessageCircle size={48} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-gray-400 text-sm">Aun no tienes conversaciones</p>
                  <p className="text-xs text-gray-300 mt-1">Explora la tienda para iniciar un chat</p>
                  <button
                    onClick={() => setActiveTab('shop')}
                    className="mt-4 inline-flex items-center gap-2 text-primary text-sm font-semibold"
                  >
                    Ir a Tienda
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                    <div className="divide-y divide-gray-100">
                      {conversations.map(t => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedThreadId(t.id)}
                          className={`w-full flex items-center gap-3 p-4 text-left transition ${selectedThreadId === t.id ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                        >
                          <img
                            src={t.otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.otherUser?.name || 'U')}&background=0F4C5C&color=fff`}
                            className="w-10 h-10 rounded-full object-cover"
                            alt={t.otherUser?.name}
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">{t.otherUser?.name || 'Usuario'}</p>
                            <p className="text-[11px] text-gray-400 truncate">{t.itemTitle || 'Conversacion'}</p>
                          </div>
                          <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{t.lastMessage?.content || ''}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {activeThread && (
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <img
                          src={activeThread.otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeThread.otherUser?.name || 'U')}&background=0F4C5C&color=fff`}
                          className="w-9 h-9 rounded-full object-cover"
                          alt={activeThread.otherUser?.name}
                        />
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{activeThread.otherUser?.name || 'Usuario'}</p>
                          <p className="text-[11px] text-gray-400 truncate">{activeThread.itemTitle || 'Conversacion'}</p>
                        </div>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto no-scrollbar mb-3">
                        {loadingMessages ? (
                          <div className="flex justify-center py-6">
                            <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                          </div>
                        ) : (
                          (messagesById[activeThread.id] || []).map((m: ChatMessage) => (
                            <div key={m.id} className={`flex ${m.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                              <div className={`px-3 py-2 rounded-2xl text-xs max-w-[75%] ${m.senderId === currentUserId ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                                {m.content}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-2">
                        <input
                          value={messageInput}
                          onChange={e => setMessageInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                          placeholder="Escribe un mensaje..."
                          className="flex-1 bg-transparent text-sm outline-none"
                        />
                        <button
                          onClick={handleChatSend}
                          disabled={!messageInput.trim()}
                          className="text-primary disabled:text-gray-300"
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Comments Modal */}
      {commentsLookId && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl animate-pop-in max-h-[90vh] flex flex-col">
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

      {/* Product Detail Modal */}
      {selectedItem && (
        <ProductDetailModal
          product={selectedItem}
          onClose={() => setSelectedItem(null)}
          onMessage={() => {
            const item = shopItems.find(s => s.id === selectedItem.id);
            handleStartChat(item);
          }}
          onShareFeed={handleShareFeed}
        />
      )}
    </div>
  );
};

export default Social;
