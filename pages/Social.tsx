import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Heart, MessageCircle, Bookmark, MoreHorizontal, ShoppingBag, Search, Tag, Send, X, Shirt, Sparkles, CheckCircle2, ArrowRight, ExternalLink, Plus, Camera, Share2, Eye } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import ProductDetailModal, { ProductDisplayItem } from '../components/ProductDetailModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ConfettiOverlay from '../components/ConfettiOverlay';
import { api, getSocketOrigin } from '../services/api';
import { Look, UserState, ShopItem, Comment, Garment, ChatConversation, ChatMessage, StoryEntry } from '../types';
import { useLanguage } from '../src/context/LanguageContext';
import { useGlobalState } from '../src/context/GlobalStateContext';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { pickPhoto, dataUrlToFile, CameraSource } from '../src/utils/cameraPhoto';

interface StoryForm {
  type: 'image' | 'text';
  text: string;
  imageUrl: string;
  selectedGarmentId: string | null;
  imageFile: File | null;
  textPosition: 'top' | 'center' | 'bottom';
  textSize: 'sm' | 'md' | 'lg';
}

interface SocialProps {
  user: UserState;
  garments: Garment[];
  onNavigate: (tab: string) => void;
  initialSubTab?: string | null;
  onSubTabConsumed?: () => void;
}

const Social: React.FC<SocialProps> = ({ user, garments, onNavigate, initialSubTab, onSubTabConsumed }) => {
  // Main tabs: 'feed', 'shop', 'trends', 'favorites', 'chat'
  const [activeTab, setActiveTab] = useState<'feed' | 'shop' | 'trends' | 'favorites' | 'chat'>('feed');

  // Handle deep-linking from notifications
  useEffect(() => {
    if (initialSubTab && ['feed', 'shop', 'trends', 'favorites', 'chat'].includes(initialSubTab)) {
      setActiveTab(initialSubTab as any);
      onSubTabConsumed?.();
    }
  }, [initialSubTab]);

  // Community Feed & Shop
  const [selectedItem, setSelectedItem] = useState<ProductDisplayItem | null>(null);
  const [feedLooks, setFeedLooks] = useState<Look[]>([]);
  const [feedCursor, setFeedCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [shopFilter, setShopFilter] = useState('all');
  const [favoritedProductIds, setFavoritedProductIds] = useState<Set<string>>(new Set());

  // Comments modal
  const [commentsLookId, setCommentsLookId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [replyToComment, setReplyToComment] = useState<{id: string; name: string} | null>(null);

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

  // Gamification & Top Users
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [stories, setStories] = useState<StoryEntry[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [storyForm, setStoryForm] = useState<StoryForm>({ type: 'image', text: '', imageUrl: '', selectedGarmentId: null, imageFile: null, textPosition: 'bottom', textSize: 'md' });
  const [storyUploadError, setStoryUploadError] = useState<string | null>(null);
  const [storyToast, setStoryToast] = useState<string | null>(null);
  const [currentChallenge, setCurrentChallenge] = useState<any>(null);
  const [challengeSubmission, setChallengeSubmission] = useState<any>(null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeImage, setChallengeImage] = useState<{ dataUrl: string; file: File } | null>(null);
  const [challengeDescription, setChallengeDescription] = useState('');
  const [challengeSubmitting, setChallengeSubmitting] = useState(false);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [challengeHistory, setChallengeHistory] = useState<any[]>([]);
  const [challengeHistoryXp, setChallengeHistoryXp] = useState(0);
  const [showChallengeHistory, setShowChallengeHistory] = useState(false);
  const [loadingChallengeHistory, setLoadingChallengeHistory] = useState(false);
  const [challengeMenuOpen, setChallengeMenuOpen] = useState(false);
  const [challengeDeletingId, setChallengeDeletingId] = useState<string | null>(null);
  const [challengeValidationMsg, setChallengeValidationMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'post' | 'story' | 'challenge'; id?: string } | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(new Set());
  const [showAllStories, setShowAllStories] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);
  const [publishedBounce, setPublishedBounce] = useState<string | null>(null);
  const [followedUserIds, setFollowedUserIds] = useState<Set<string>>(new Set());
  const [chatAttachment, setChatAttachment] = useState<string | null>(null);
  const chatFileInputRef = useRef<HTMLInputElement | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string[]>>({});
  const [chatSocket, setChatSocket] = useState<Socket | null>(null);

  // Publish Post Modal (Instagram-style)
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [publishPhoto, setPublishPhoto] = useState<string | null>(null);
  const [publishPhotoFile, setPublishPhotoFile] = useState<File | null>(null);
  const [publishDescription, setPublishDescription] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Click-to-Shop Modal
  const [shopModalLook, setShopModalLook] = useState<Look | null>(null);

  // Delete menu state
  const [postMenuOpenId, setPostMenuOpenId] = useState<string | null>(null);
  const [storyMenuOpenId, setStoryMenuOpenId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);

  const currentUserId = useMemo(() => {
    const raw = localStorage.getItem('beyour_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw).id || null;
    } catch {
      return null;
    }
  }, []);

  const { handleUpdateUser, user: globalUser } = useGlobalState();
  const activeUser = globalUser || user;

  const { t } = useLanguage();

  useLocalStorage<StoryEntry[]>('ev_social_stories', stories);

  useEffect(() => {
    const loadStories = async () => {
      try {
        const localRaw = localStorage.getItem('ev_social_stories');
        const localStories: StoryEntry[] = localRaw ? JSON.parse(localRaw) : [];
        const validLocal = localStories.filter(item => new Date(item.expiresAt) > new Date());

        let merged = [...validLocal];
        try {
          const apiStories = await api.getStories();
          const apiIds = new Set(apiStories.map(s => s.id));
          merged = [...apiStories, ...validLocal.filter(s => !apiIds.has(s.id))];
        } catch (err) {
          console.warn('Could not load stories from API, using local cache:', err);
        }

        localStorage.setItem('ev_social_stories', JSON.stringify(merged));
        setStories(merged);
      } catch (error) {
        console.warn('No se pudieron cargar las historias guardadas:', error);
        setStories([]);
      }
    };
    loadStories();

    try {
      const savedFollowing = localStorage.getItem('ev_social_followed');
      const list = savedFollowing ? JSON.parse(savedFollowing) : [];
      setFollowedUserIds(new Set<string>(Array.isArray(list) ? list : []));
    } catch {
      setFollowedUserIds(new Set());
    }
  }, []);

  // Prioritize stories from followed users
  const prioritizedStories = useMemo(() => {
    return [...stories].sort((a, b) => {
      // Own story always first
      if (a.isOwn && !b.isOwn) return -1;
      if (!a.isOwn && b.isOwn) return 1;
      
      // Followed users next
      const aFollowed = followedUserIds.has(a.userId);
      const bFollowed = followedUserIds.has(b.userId);
      if (aFollowed && !bFollowed) return -1;
      if (!aFollowed && bFollowed) return 1;
      
      // Then by creation time (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [stories, followedUserIds]);

  useEffect(() => {
    localStorage.setItem('ev_social_followed', JSON.stringify(Array.from(followedUserIds)));
  }, [followedUserIds]);

  // === DATA LOADING ===
  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await api.getCommunityFeed();
      const socialFeed = result.items.filter(look => {
        if (look.garments && look.garments.some(g => g.forSale)) return false;
        if (look.mood && look.mood.toLowerCase().includes('venta')) return false;
        if (look.tags && look.tags.some(tag => tag.toLowerCase().includes('venta'))) return false;
        return true;
      });
      setFeedLooks(socialFeed);
      setFeedCursor(result.nextCursor || null);
      setFeedHasMore(result.hasMore || false);
      const top = await api.getTopUsers();
      setTopUsers(top);
    } catch (error) {
      console.error("Error loading feed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMoreFeed = useCallback(async () => {
    if (!feedCursor || feedLoadingMore) return;
    setFeedLoadingMore(true);
    try {
      const result = await api.getCommunityFeed(feedCursor);
      const socialFeed = result.items.filter(look => {
        if (look.garments && look.garments.some(g => g.forSale)) return false;
        if (look.mood && look.mood.toLowerCase().includes('venta')) return false;
        if (look.tags && look.tags.some(tag => tag.toLowerCase().includes('venta'))) return false;
        return true;
      });
      setFeedLooks(prev => [...prev, ...socialFeed]);
      setFeedCursor(result.nextCursor || null);
      setFeedHasMore(result.hasMore || false);
    } catch (error) {
      console.error("Error loading more feed:", error);
    } finally {
      setFeedLoadingMore(false);
    }
  }, [feedCursor, feedLoadingMore]);

  const loadShop = useCallback(async () => {
    setIsLoading(true);
    try {
      const category = shopFilter !== 'all' ? shopFilter : undefined;
      const items = await api.getShopProducts(searchQuery || undefined, category);
      // Ensure only items with price (for sale) are shown in shop
      const salesItems = items.filter(item => item.price > 0);
      setShopItems(salesItems);
    } catch (error) {
      console.error("Error loading shop:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, shopFilter]);

  // Fashion Trends
  const [fashionTrends, setFashionTrends] = useState<any[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);

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

  const loadTrends = useCallback(async () => {
    setLoadingTrends(true);
    try {
      const data = await api.getTrends();
      setFashionTrends(data);
    } catch (e) {
      console.warn('Could not load trends:', e);
    } finally {
      setLoadingTrends(false);
    }
  }, []);

  const addXp = (amount: number, reason: string) => {
    if (!activeUser) return;
    const currentXp = activeUser.experiencePoints || 0;
    const nextXp = currentXp + amount;
    const currentLevel = activeUser.level || 1;
    const nextLevel = Math.max(1, Math.floor(nextXp / 100) + 1);
    const leveledUp = nextLevel > currentLevel;
    handleUpdateUser({ ...activeUser, experiencePoints: nextXp, level: nextLevel });
    setStoryToast(leveledUp ? `¡Subiste al nivel ${nextLevel}! +${amount} XP por ${reason}` : `+${amount} XP por ${reason}`);
    window.setTimeout(() => setStoryToast(null), 3200);
  };

  useEffect(() => {
    const loadChallenge = async () => {
      setLoadingChallenge(true);
      try {
        const challenge = await api.getCurrentChallenge();
        setCurrentChallenge(challenge);
        const subs = await api.getMySubmissions();
        const existing = subs.find((s: any) => s.challengeId === challenge.id);
        setChallengeSubmission(existing || null);
      } catch (e) {
        console.warn('Could not load challenge:', e);
      } finally {
        setLoadingChallenge(false);
      }
    };
    loadChallenge();
  }, []);

  const loadChallengeHistory = async () => {
    if (challengeHistory.length > 0) { setShowChallengeHistory(true); return; }
    setLoadingChallengeHistory(true);
    try {
      const result = await api.getChallengeHistory();
      setChallengeHistory(result.challenges || []);
      setChallengeHistoryXp(result.totalXp || 0);
      setShowChallengeHistory(true);
    } catch (e) {
      console.warn('Could not load challenge history:', e);
    } finally {
      setLoadingChallengeHistory(false);
    }
  };

  const handleParticipateChallenge = () => {
    if (!currentChallenge || challengeSubmission) return;
    setShowChallengeModal(true);
    setChallengeValidationMsg(null);
  };

  const handleChallengePickImage = async (source?: 'camera' | 'gallery') => {
    try {
      const result = await pickPhoto(source || 'gallery');
      setChallengeImage(result);
    } catch { }
  };

  const handleChallengeSubmit = async () => {
    if (!currentChallenge || challengeSubmitting) return;
    if (!challengeImage) {
      setChallengeValidationMsg('Debes seleccionar una imagen para participar');
      return;
    }
    if (!challengeDescription.trim() || challengeDescription.trim().length < 10) {
      setChallengeValidationMsg('La descripción debe tener al menos 10 caracteres');
      return;
    }
    setChallengeSubmitting(true);
    setChallengeValidationMsg(null);
    try {
      const formData = new FormData();
      formData.append('challengeId', currentChallenge.id);
      formData.append('description', challengeDescription.trim());
      if (challengeImage?.file) formData.append('image', challengeImage.file);
      const result = await api.submitChallenge(formData);
      setChallengeSubmission(result);
      setShowChallengeModal(false);
      setChallengeImage(null);
      setChallengeDescription('');
      setConfettiActive(true);
      if (activeUser && result.experiencePoints !== undefined) {
        handleUpdateUser({ ...activeUser, experiencePoints: result.experiencePoints, level: result.level || Math.floor(result.experiencePoints / 100) + 1 });
      }
      setStoryToast(result.validationMessage || `+${currentChallenge.reward} XP por participar en el reto semanal`);
      window.setTimeout(() => setStoryToast(null), 4000);
    } catch (e: any) {
      setChallengeValidationMsg(e?.message || 'Error al participar');
    } finally {
      setChallengeSubmitting(false);
    }
  };

  const handleDeleteChallengeSubmission = async () => {
    if (!challengeSubmission || challengeDeletingId) return;
    setChallengeDeletingId(challengeSubmission.id);
    setChallengeMenuOpen(false);
    setConfirmDelete(null);
    try {
      await api.deleteChallengeSubmission(challengeSubmission.id);
      if (activeUser) {
        const reward = currentChallenge?.reward || 0;
        const newXp = Math.max(0, (activeUser.experiencePoints || 0) - reward);
        const newLevel = Math.floor(newXp / 100) + 1;
        handleUpdateUser({ ...activeUser, experiencePoints: newXp, level: newLevel });
      }
      setChallengeSubmission(null);
      setStoryToast('Participación eliminada. Puedes volver a participar.');
      window.setTimeout(() => setStoryToast(null), 3200);
    } catch (e: any) {
      setStoryToast(e?.message || 'Error al eliminar');
      window.setTimeout(() => setStoryToast(null), 3200);
    } finally {
      setChallengeDeletingId(null);
    }
  };

  const toggleFollowUser = async (userId: string) => {
    try {
      const result = await api.toggleFollow(userId);
      setFollowedUserIds(prev => {
        const next = new Set(prev);
        if (result.following) next.add(userId);
        else next.delete(userId);
        return next;
      });
    } catch (error) {
      console.warn('Error toggling follow:', error);
    }
  };

  const handleStoryPhotoPick = async (source: CameraSource) => {
    setStoryUploadError(null);
    try {
      const { dataUrl, file } = await pickPhoto(source);
      setStoryForm(prev => ({ ...prev, type: 'image', text: '', imageUrl: dataUrl, imageFile: file, selectedGarmentId: null }));
    } catch (err: any) {
      const rawMessage = String(err?.message || err || '');
      const message = rawMessage.toLowerCase();
      if (message.includes('cancel') || message.includes('cancelado')) return;
      setStoryUploadError(
        message.includes('permiso')
          ? rawMessage
          : 'No se pudo obtener la imagen. Revisa los permisos de cámara y galería.'
      );
    }
  };

  const handlePublishStory = async () => {
    if (storyForm.type === 'text' && !storyForm.text.trim()) {
      setStoryUploadError('Escribe una frase o reflexión para tu historia.');
      return;
    }
    if (storyForm.type === 'image' && !storyForm.imageUrl) {
      setStoryUploadError('Selecciona una foto o un look para publicar.');
      return;
    }

    const overlayText = storyForm.type === 'image' ? storyForm.text.trim() || undefined : undefined;

    const newStory: StoryEntry = {
      id: `story-${Date.now()}`,
      userId: activeUser?.id || 'me',
      userName: activeUser?.name || 'Tú',
      userAvatar: activeUser?.avatar,
      type: storyForm.type,
      text: storyForm.type === 'text' ? storyForm.text.trim() : overlayText,
      imageUrl: storyForm.type === 'image' ? storyForm.imageUrl : undefined,
      views: 0,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      isOwn: true,
    };

    const hadStories = stories.length > 0;
    setStories(prev => [newStory, ...prev]);
    setIsCreateStoryOpen(false);
    setStoryForm({ type: 'image', text: '', imageUrl: '', selectedGarmentId: null, imageFile: null, textPosition: 'bottom', textSize: 'md' });
    setStoryUploadError(null);

    try {
      const saved = await api.createStory({
        type: storyForm.type,
        text: storyForm.type === 'image' ? overlayText : storyForm.text.trim() || undefined,
        imageUrl: storyForm.type === 'image' ? storyForm.imageUrl : undefined,
        imageFile: storyForm.imageFile,
      });
      setStories(prev => prev.map(s => s.id === newStory.id ? { ...s, id: saved.id } : s));
    } catch (err) {
      console.warn('Could not save story to server, using local:', err);
    }

    addXp(15, 'subir una historia');
    setPublishedBounce('story');
    window.setTimeout(() => setPublishedBounce(null), 800);
    setStoryToast(hadStories ? 'Tu historia se publicó con éxito.' : '¡Bienvenida a tu primera historia!');
    window.setTimeout(() => setStoryToast(null), 3200);
  };

  const handleStoryView = (storyId: string) => {
    setSelectedStoryId(storyId);
    setViewedStoryIds(prev => new Set(prev).add(storyId));
    setStories(prev => prev.map(story => story.id === storyId ? { ...story, views: story.views + 1 } : story));
    api.viewStory(storyId).catch(err => console.warn('Could not track story view on server:', err));
  };

  const handleChatAttach = async () => {
    if (chatFileInputRef.current) {
      chatFileInputRef.current.click();
      return;
    }
    try {
      const { dataUrl } = await pickPhoto(CameraSource.Photos);
      setChatAttachment(dataUrl);
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (!msg.includes('cancel') && !msg.includes('cancelado')) {
        console.warn('Error attaching chat image:', err);
      }
    }
  };

  const handleChatAttachmentUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setChatAttachment(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const sendChatMessage = () => {
    if (!activeThread || (!messageInput.trim() && !chatAttachment)) return;
    const content = messageInput.trim() || '📷 Imagen adjunta';
    const nextMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: activeThread.id,
      senderId: currentUserId || 'me',
      content,
      imageUrl: chatAttachment || undefined,
      createdAt: new Date().toISOString(),
    };

    setMessagesById(prev => ({
      ...prev,
      [activeThread.id]: [...(prev[activeThread.id] || []), nextMessage]
    }));

    setMessageInput('');
    setChatAttachment(null);

    api.sendConversationMessage(activeThread.id, content).catch(e => console.warn('Error sending chat message:', e));
  };

  const getPostUserLevel = (post: Look) => {
    const score = (post.likesCount || 0) + (post.commentsCount || 0);
    return Math.max(1, Math.min(12, Math.ceil((score + 1) / 10)));
  };

  const getStoryOwnerBadge = (story: StoryEntry) => {
    if (story.isOwn) return 'Tú';
    return `Lv. ${Math.max(1, Math.min(12, Math.ceil((story.views + 1) / 8)))}`;
  };

  const loadConversations = useCallback(async () => {
    const draftRaw = localStorage.getItem('ev_chat_draft');
    const openId = localStorage.getItem('ev_chat_open');

    // Always clean up drafts immediately to prevent stale data
    localStorage.removeItem('ev_chat_draft');

    setLoadingConversations(true);
    try {
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        // Only create conversation if target is NOT yourself
        if (draft.targetUserId && draft.targetUserId !== currentUserId) {
          try {
            const created = await api.createConversation({
              targetUserId: draft.targetUserId,
              itemId: draft.itemId,
              itemTitle: draft.itemTitle,
              itemImage: draft.itemImage,
              initialMessage: draft.message,
            });
            localStorage.setItem('ev_chat_open', created.id);
          } catch (draftErr) {
            console.warn('Could not create conversation from draft:', draftErr);
          }
        }
      }

      const data = await api.getConversations();
      setConversations(data);
      const finalOpenId = localStorage.getItem('ev_chat_open') || openId;
      const nextId = finalOpenId || data[0]?.id || null;
      if (nextId) setSelectedThreadId(nextId);
    } catch (e) {
      console.warn('Error loading conversations:', e);
    } finally {
      setLoadingConversations(false);
      localStorage.removeItem('ev_chat_open');
    }
  }, [currentUserId]);

  useEffect(() => {
    if (activeTab === 'feed') loadFeed();
    else if (activeTab === 'shop') {
      loadShop();
      loadFavorites();
    }
    else if (activeTab === 'favorites') loadFavorites();
    else if (activeTab === 'chat') loadConversations();
    else if (activeTab === 'trends') loadTrends();
  }, [activeTab, loadFeed, loadShop, loadFavorites, loadConversations, loadTrends]);

  // Socket connection for real-time chat
  useEffect(() => {
    if (activeTab !== 'chat') {
      if (chatSocket) { chatSocket.disconnect(); setChatSocket(null); }
      return;
    }
    const newSocket = io(getSocketOrigin(), { withCredentials: true, transports: ['polling'] });
    setChatSocket(newSocket);

    newSocket.on('new_message', (message: ChatMessage) => {
      setMessagesById(prev => {
        const threadMessages = prev[message.conversationId] || [];
        if (threadMessages.some(m => m.id === message.id)) return prev;
        return { ...prev, [message.conversationId]: [...threadMessages, message] };
      });
      setConversations(prev => prev.map(c => c.id === message.conversationId
        ? { ...c, updatedAt: message.createdAt, lastMessage: { id: message.id, content: message.content, createdAt: message.createdAt, sender: message.sender } }
        : c
      ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));
    });

    return () => { newSocket.disconnect(); setChatSocket(null); };
  }, [activeTab]);

  // Join conversation rooms when loaded
  useEffect(() => {
    if (chatSocket && conversations.length > 0) {
      conversations.forEach(c => chatSocket.emit('join_room', c.id));
    }
  }, [chatSocket, conversations]);

  // Reload shop when category filter changes
  useEffect(() => {
    if (activeTab === 'shop') {
      loadShop();
    }
  }, [shopFilter]);

  // === PUBLISH LOOK HANDLERS (Instagram-style) ===
  const handlePublishPhotoPick = async (source: CameraSource) => {
    setPublishError(null);
    try {
      const { dataUrl, file } = await pickPhoto(source);
      setPublishPhoto(dataUrl);
      setPublishPhotoFile(file);
    } catch (err: any) {
      const rawMessage = String(err?.message || err || '');
      const msg = rawMessage.toLowerCase();
      if (msg.includes('cancel') || msg.includes('cancelado')) return;
      setPublishError(rawMessage || 'No se pudo seleccionar la foto.');
    }
  };

  const handlePublishSubmit = async () => {
    if (!publishPhoto) return;
    setIsPublishing(true);
    setPublishError(null);

    try {
      const imageBlob = publishPhotoFile || await fetch(publishPhoto).then(r => r.blob()).catch(() => null);

      if (!imageBlob) {
        setPublishError('No se pudo procesar la imagen. Inténtalo de nuevo.');
        setIsPublishing(false);
        return;
      }

      const saved = await api.saveLookWithImage(
        publishDescription.trim() || 'Publicación',
        [],
        imageBlob
      );
      setFeedLooks(prev => [saved, ...prev]);
      setIsPublishModalOpen(false);
      setPublishPhoto(null);
      setPublishPhotoFile(null);
      setPublishDescription('');
      setPublishedBounce('post');
      window.setTimeout(() => setPublishedBounce(null), 800);
      addXp(20, 'publicar en el feed');
      setStoryToast('Publicación compartida +20 XP');
      window.setTimeout(() => setStoryToast(null), 3200);
    } catch (error) {
      console.error("Error publishing:", error);
      setPublishError('Error al publicar. Inténtalo de nuevo.');
    } finally {
      setIsPublishing(false);
    }
  };

  // === FEED HANDLERS ===
  const handleToggleLike = async (lookId: string) => {
    try {
      const likedBefore = feedLooks.find(l => l.id === lookId)?.isLiked;
      const result = await api.toggleLike(lookId);
      setFeedLooks(prev => prev.map(l => {
        if (l.id === lookId) {
          return { ...l, isLiked: result.liked, likesCount: result.likesCount };
        }
        return l;
      }));
      if (!likedBefore && result.liked) {
        addXp(2, 'dar me gusta');
        setStoryToast('Me gusta dado +2 XP');
        window.setTimeout(() => setStoryToast(null), 3200);
      }
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

  const handleDeletePost = async (postId: string) => {
    setDeletingPostId(postId);
    setConfirmDelete(null);
    try {
      await api.deleteLook(postId);
      setFeedLooks(prev => prev.filter(l => l.id !== postId));
    } catch (error) {
      console.error("Error deleting post:", error);
      setStoryToast('Error al eliminar la publicación');
      window.setTimeout(() => setStoryToast(null), 3200);
    } finally {
      setDeletingPostId(null);
      setPostMenuOpenId(null);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    setDeletingStoryId(storyId);
    setConfirmDelete(null);
    try {
      await api.deleteStory(storyId);
      setStories(prev => prev.filter(s => s.id !== storyId));
      if (selectedStoryId === storyId) setSelectedStoryId(null);
    } catch (error) {
      console.error("Error deleting story:", error);
      setStoryToast('Error al eliminar la historia');
      window.setTimeout(() => setStoryToast(null), 3200);
    } finally {
      setDeletingStoryId(null);
      setStoryMenuOpenId(null);
    }
  };

  const handleShareNative = (post: Look) => {
    const url = `${window.location.origin}/look/${post.id}`;
    if (navigator.share) {
      navigator.share({
        title: post.name || 'Look en Estilo Vivo',
        text: post.mood || 'Mira este look en Estilo Vivo',
        url,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setStoryToast('Enlace copiado al portapapeles');
        window.setTimeout(() => setStoryToast(null), 2500);
      }).catch(() => {});
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
      const newComment = await api.addComment(commentsLookId, commentInput.trim(), replyToComment?.id);
      if (replyToComment) {
        setComments(prev => prev.map(c => c.id === replyToComment.id ? { ...c, replies: [...(c.replies || []), newComment] } : c));
      } else {
        setComments(prev => [newComment, ...prev]);
      }
      setCommentInput('');
      setReplyToComment(null);
      // Update count in feed
      setFeedLooks(prev => prev.map(l => {
        if (l.id === commentsLookId) {
          return { ...l, commentsCount: (l.commentsCount || 0) + 1 };
        }
        return l;
      }));
      addXp(3, 'comentar una publicación');
      // Show notification toast
      setStoryToast('Comentario enviado +3 XP');
      window.setTimeout(() => setStoryToast(null), 3200);
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
      size: item.size,
      isOwnItem: item.userId === currentUserId || (item as any).user?.id === currentUserId
    });
  };

  const handleStartChat = async (item?: ShopItem, product?: any) => {
    const targetItem = item || product;
    if (!targetItem) {
      setActiveTab('chat');
      return;
    }

    // Prevent chatting with yourself
    const targetUserId = targetItem.userId || targetItem.user?.id;
    if (targetUserId === currentUserId) {
      return;
    }

    // If just a user (no product), start a simple conversation
    if (!targetItem.id && targetItem.user) {
      try {
        const res = await api.createConversation({
          targetUserId,
          itemId: undefined,
          itemTitle: undefined,
          itemImage: undefined,
          initialMessage: undefined,
        });
        localStorage.setItem('ev_chat_open', res.id);
      } catch (e) {
        console.warn('Could not create conversation:', e);
      }
      setActiveTab('chat');
      return;
    }

    try {
      const res = await api.createConversation({
        targetUserId,
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
        targetUserId,
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

  const handleChatSend = async () => {
    if (!activeThread || (!messageInput.trim() && !chatAttachment)) return;
    const content = messageInput.trim() || '📷 Imagen adjunta';
    let serverImageUrl: string | undefined;
    if (chatAttachment) {
      try {
        const blob = await fetch(chatAttachment).then(r => r.blob());
        const file = new File([blob], `chat-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const { imageUrl } = await api.uploadChatImage(file);
        serverImageUrl = imageUrl;
      } catch {
        serverImageUrl = chatAttachment;
      }
    }
    const nextMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      conversationId: activeThread.id,
      senderId: currentUserId || 'me',
      content,
      imageUrl: serverImageUrl,
      createdAt: new Date().toISOString(),
    };

    setMessagesById(prev => ({
      ...prev,
      [activeThread.id]: [...(prev[activeThread.id] || []), nextMessage]
    }));
    setConversations(prev => prev.map(c => c.id === activeThread.id
      ? {
        ...c,
        updatedAt: nextMessage.createdAt,
        lastMessage: {
          id: nextMessage.id,
          content: nextMessage.content,
          createdAt: nextMessage.createdAt,
          sender: c.otherUser
        }
      }
      : c
    ));
    setMessageInput('');
    setChatAttachment(null);

    api.sendConversationMessage(activeThread.id, content, serverImageUrl).catch((e) => {
      console.warn('Error sending message:', e);
    });

    // Show notification for sales-related chat
    if (activeThread.itemTitle) {
      setStoryToast('Mensaje enviado al vendedor');
      window.setTimeout(() => setStoryToast(null), 3200);
    }
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    setMessageReactions(prev => {
      const reactions = prev[messageId] || [];
      if (reactions.includes(emoji)) {
        // Remove reaction if already exists
        return { ...prev, [messageId]: reactions.filter(r => r !== emoji) };
      }
      // Add reaction
      return { ...prev, [messageId]: [...reactions, emoji] };
    });
    addXp(1, 'reaccionar a mensaje');
    setStoryToast('Reacción añadida +1 XP');
    window.setTimeout(() => setStoryToast(null), 3200);
  };

  // === UTILS ===
  const getLookImage = (look: Look) => {
    if (look.imageUrl) return look.imageUrl;
    if (look.garments && look.garments.length > 0) return look.garments[0].imageUrl;
    if ((look as any).images?.length > 0) return (look as any).images[0].url || (look as any).images[0];
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

        <div className="relative">
          <div className="flex bg-gray-100 rounded-full p-1 overflow-x-auto scroll-smooth" style={{ maskImage: 'linear-gradient(to right, black 90%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to right, black 90%, transparent 100%)' }}>
            {[
              { key: 'feed', label: 'Feed', icon: '📰' },
              { key: 'shop', label: 'Tienda', icon: '🛍️' },
              { key: 'trends', label: 'Tendencias', icon: '📈' },
              { key: 'favorites', label: 'Favoritos', icon: '❤️' },
              { key: 'chat', label: 'Chat', icon: '💬' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${activeTab === tab.key ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
              >
                <span className="text-sm leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sub-headers per tab */}
        {activeTab === 'feed' && currentChallenge && !loadingChallenge && (
          <div
            onClick={() => {
              if (!challengeSubmission) handleParticipateChallenge();
            }}
            className="bg-gradient-to-r from-primary to-accent rounded-2xl p-4 text-white relative animate-fade-in mt-4 cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden">
              <div className="w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
            </div>
            <div className="relative z-10">
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-accent text-[10px] font-bold uppercase tracking-wider rounded-md mb-2">
                <Sparkles size={12} /> Reto Semanal
              </span>
              <h3 className="font-bold text-lg mb-1">{currentChallenge.title}</h3>
              <p className="text-sm text-teal-100 opacity-90 mb-3 line-clamp-2">{currentChallenge.description}</p>

              {/* XP Progress bar */}
              {activeUser && (
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] text-teal-100 mb-1">
                    <span>Nivel {activeUser.level || 1}</span>
                    <span>{(activeUser.experiencePoints || 0) % 100} / 100 XP</span>
                  </div>
                  <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${(activeUser.experiencePoints || 0) % 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {challengeSubmission ? (
                  <>
                    <span className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-400 text-white">
                      <CheckCircle2 size={12} /> Completado
                    </span>
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setChallengeMenuOpen(!challengeMenuOpen); }}
                        className="p-1.5 rounded-full text-white/80 hover:bg-white/20 transition-colors"
                      >
                        <MoreHorizontal size={14} />
                      </button>
                      {challengeMenuOpen && (
                        <div className="absolute left-0 top-8 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[180px] animate-fade-in">
                          <button
                            onClick={(e) => { e.stopPropagation(); setChallengeMenuOpen(false); setConfirmDelete({ type: 'challenge' }); }}
                            disabled={!!challengeDeletingId}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            {challengeDeletingId ? 'Eliminando...' : 'Eliminar participación'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setChallengeMenuOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold text-teal-100 bg-black/20 px-2 py-1 rounded-full">
                      +{currentChallenge.reward} XP
                    </span>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleParticipateChallenge(); }}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-primary hover:bg-primary hover:text-white transition-all"
                    >
                      Participar
                    </button>
                    <span className="text-xs font-bold text-teal-100 bg-black/20 px-2 py-1 rounded-full">
                      +{currentChallenge.reward} XP
                    </span>
                  </>
                )}
                {!challengeSubmission && (
                  <button
                    onClick={(e) => { e.stopPropagation(); loadChallengeHistory(); }}
                    className="text-[10px] font-medium text-white/70 hover:text-white underline ml-auto"
                  >
                    Ver historial
                  </button>
                )}
                <div className="flex gap-2 w-full justify-end mt-1">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await api.forceRotateChallenge();
                        setStoryToast('🔄 Reto cambiado');
                        window.setTimeout(() => setStoryToast(null), 2000);
                        window.location.reload();
                      } catch { setStoryToast('Error al cambiar reto'); window.setTimeout(() => setStoryToast(null), 2000); }
                    }}
                    className="text-[9px] font-medium text-white/50 hover:text-white underline"
                  >
                    Forzar cambio
                  </button>
                </div>
              </div>
            </div>
            <Sparkles className="text-white/20 absolute right-4 bottom-4 w-12 h-12" />
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
      {isLoading || (activeTab === 'chat' && loadingConversations) || (activeTab === 'trends' && loadingTrends) ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* FEED TAB */}
          {activeTab === 'feed' && (
            <div className="px-4 pb-20 animate-fade-in space-y-6">

              {storyToast && (
                <div className="fixed top-24 right-4 z-50 rounded-3xl bg-primary text-white px-4 py-3 shadow-2xl shadow-primary/30 animate-fade-in">
                  {storyToast}
                </div>
              )}

              {/* Stories Carousel - Instagram-style bubbles */}
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 mb-6 overflow-hidden">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-gray-400">Historias</p>
                      <h2 className="text-lg font-bold text-gray-800">Lo último de la comunidad</h2>
                    </div>
                    {stories.filter(s => !s.isOwn && !viewedStoryIds.has(s.id)).length > 0 && (
                      <span className="bg-primary text-white text-[10px] font-bold rounded-full px-2 py-0.5 leading-none mt-1">
                        +{stories.filter(s => !s.isOwn && !viewedStoryIds.has(s.id)).length} nuevas
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {stories.length > 6 && (
                      <button
                        onClick={() => setShowAllStories(true)}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        <Eye size={14} className="inline mr-1" />Ver todas
                      </button>
                    )}
                    <button
                      onClick={() => setIsCreateStoryOpen(true)}
                      className="bg-primary text-white text-xs font-bold uppercase px-4 py-2 rounded-full shadow-sm transition-colors"
                    >
                      Crear nueva historia
                    </button>
                  </div>
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 px-1">
                  <button
                    type="button"
                    onClick={() => setIsCreateStoryOpen(true)}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                  >
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors">
                      <Plus size={22} />
                    </div>
                    <span className="text-[10px] text-gray-500 font-medium">Nueva</span>
                  </button>

                  {stories.length === 0 ? (
                    <div className="flex items-center justify-center text-sm text-gray-400 h-20 px-4">
                      Publica tu primera historia y gana visibilidad.
                    </div>
                  ) : prioritizedStories.map(story => {
                    const isViewed = viewedStoryIds.has(story.id);
                    return (
                      <button
                        key={story.id}
                        type="button"
                        onClick={() => handleStoryView(story.id)}
                        className={`flex flex-col items-center gap-1.5 flex-shrink-0 group ${isViewed && !story.isOwn ? 'opacity-60' : ''}`}
                      >
                        <div className={`w-16 h-16 rounded-full ${isViewed && !story.isOwn ? 'bg-gray-200' : 'bg-gradient-to-br from-primary via-accent to-amber-400'} p-[2px] shadow-sm group-hover:shadow-md transition-shadow`}>
                          <div className="w-full h-full rounded-full bg-white p-[2px]">
                            {story.imageUrl ? (
                              <img src={story.imageUrl} alt={story.text || 'Historia'} className="w-full h-full rounded-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-primary text-[10px] font-bold px-1 text-center leading-tight">
                                {story.text?.slice(0, 20) || 'Texto'}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-600 font-medium max-w-[68px] truncate">{story.userName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ver todas stories modal */}
              {showAllStories && (
                <div className="fixed inset-0 z-[60] bg-white animate-fade-in overflow-y-auto" onClick={() => setShowAllStories(false)}>
                  <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
                    <h3 className="font-bold text-gray-800">Todas las historias</h3>
                    <button onClick={() => setShowAllStories(false)} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-4" onClick={e => e.stopPropagation()}>
                    {prioritizedStories.filter(s => !s.isOwn).length === 0 ? (
                      <p className="col-span-3 text-center text-gray-400 py-10 text-sm">No hay historias de otros usuarios</p>
                    ) : prioritizedStories.filter(s => !s.isOwn).map(story => (
                      <button
                        key={story.id}
                        onClick={() => { setShowAllStories(false); handleStoryView(story.id); }}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <div className={`w-16 h-16 rounded-full ${viewedStoryIds.has(story.id) ? 'bg-gray-200' : 'bg-gradient-to-br from-primary via-accent to-amber-400'} p-[2px] shadow-sm`}>
                          <div className="w-full h-full rounded-full bg-white p-[2px]">
                            {story.imageUrl ? (
                              <img src={story.imageUrl} alt={story.text || 'Historia'} className="w-full h-full rounded-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-primary text-[10px] font-bold px-1 text-center leading-tight">
                                {story.text?.slice(0, 15) || 'Texto'}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-600 font-medium truncate max-w-[68px]">{story.userName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Users (Iconos de Estilo) Widget */}
              {topUsers.length > 0 && (
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 mb-6 overflow-hidden">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <Sparkles className="text-amber-500 w-4 h-4" />
                    <h3 className="text-sm font-bold text-gray-800 tracking-wide uppercase">Iconos de Estilo</h3>
                  </div>
                  <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar px-1 snap-x">
                    {topUsers.map((tu, idx) => (
                      <div key={tu.id} className="flex flex-col items-center flex-shrink-0 snap-center w-16">
                        <div className="relative">
                           <img
                            src={tu.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(tu.name)}&background=0F4C5C&color=fff`}
                            className={`w-14 h-14 rounded-full object-cover border-2 shadow-sm ${idx === 0 ? 'border-amber-400' : idx === 1 ? 'border-gray-300' : idx === 2 ? 'border-amber-700' : 'border-primary/20'}`}
                            alt={tu.name} loading="lazy"
                          />
                          <div className="absolute -bottom-1 -right-1 bg-primary text-white text-[9px] font-bold w-5 h-5 flex items-center justify-center rounded-full border border-white">
                            {tu.level || 1}
                          </div>
                          {idx === 0 && (
                            <div className="absolute -top-2 -right-1 text-amber-500 bg-white rounded-full">👑</div>
                          )}
                        </div>
                        <p className="text-[10px] font-semibold text-gray-700 truncate w-full text-center mt-1.5">{tu.name.split(' ')[0]}</p>
                        <p className="text-[9px] text-gray-400">{tu.experiencePoints} XP</p>
                        <button
                          onClick={() => toggleFollowUser(tu.id)}
                          className={`mt-2 text-[10px] font-bold px-2 py-1 rounded-full transition ${followedUserIds.has(tu.id) ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
                        >
                          {followedUserIds.has(tu.id) ? 'Siguiendo' : 'Seguir'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feed Grid - Instagram-style single column */}
              <div className="space-y-5">
                {feedLooks.map((post) => {
                  const postImage = getLookImage(post);

                  return (
                    <div key={post.id} className="bg-white rounded-[1.5rem] overflow-hidden shadow-sm border border-gray-100">

                      {/* Creator Header */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <img
                          src={post.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.userName || 'U')}&background=0F4C5C&color=fff`}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          alt={post.userName} loading="lazy"
                        />
                        <span className="text-sm font-semibold text-gray-800">{post.userName || 'Usuario'}</span>
                        <span className="text-[10px] text-gray-400 ml-auto font-medium">Lv.{getPostUserLevel(post)}</span>
                        {post.userId !== currentUserId && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartChat(undefined, { user: { id: post.userId, name: post.userName, avatar: post.userAvatar } }); }}
                            className="p-1.5 rounded-full text-gray-400 hover:text-primary hover:bg-primary/5 transition-colors"
                            title="Enviar mensaje"
                          >
                            <Send size={14} />
                          </button>
                        )}
                        {post.userId === currentUserId && (
                          <div className="relative">
                            <button
                              onClick={() => setPostMenuOpenId(postMenuOpenId === post.id ? null : post.id)}
                              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              <MoreHorizontal size={16} />
                            </button>
                            {postMenuOpenId === post.id && (
                              <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[170px] animate-fade-in">
                                <button
                                  onClick={() => { setConfirmDelete({ type: 'post', id: post.id }); setPostMenuOpenId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-red-600 font-medium hover:bg-red-50 transition-colors"
                                >
                                  Eliminar publicación
                                </button>
                                <button
                                  onClick={() => setPostMenuOpenId(null)}
                                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Image */}
                      {postImage ? (
                        <div className="bg-gray-100">
                          <img src={postImage} className="w-full aspect-square object-cover" loading="lazy" alt={post.name} />
                        </div>
                      ) : (
                        <div className="aspect-square bg-gray-50 flex items-center justify-center">
                          <Shirt size={40} className="text-gray-300" />
                        </div>
                      )}

                      {/* Post Footer */}
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => handleToggleLike(post.id)}
                            className={`flex items-center gap-1.5 text-sm transition-colors ${post.isLiked ? 'text-rose-500' : 'text-gray-500 hover:text-rose-400'}`}
                          >
                            <Heart size={18} fill={post.isLiked ? "currentColor" : "none"} />
                            <span className="font-semibold">{post.likesCount || 0}</span>
                          </button>
                          <button
                            onClick={() => openComments(post.id)}
                            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                          >
                            <MessageCircle size={18} />
                            <span className="font-semibold">{post.commentsCount || 0}</span>
                          </button>
                          <button
                            onClick={() => handleShareNative(post)}
                            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors ml-auto"
                          >
                            <Share2 size={16} />
                          </button>
                        </div>
                        {post.name && (
                          <p className="text-sm text-gray-800 font-medium mt-2 leading-snug">{post.name}</p>
                        )}
                        {post.mood && (
                          <p className="text-sm text-gray-500 mt-1 leading-relaxed">{post.mood}</p>
                        )}
                        <p className="text-[11px] text-gray-400 mt-2">
                          {new Date(post.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {feedLooks.length === 0 && (
                <div className="text-center py-16 px-6">
                  <div className="w-20 h-20 mx-auto mb-5 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center animate-bounce-in">
                    <Sparkles size={36} className="text-primary" />
                  </div>
                  <p className="text-lg font-bold text-gray-700 mb-2">✨ Sé la primera en inspirar a la comunidad</p>
                  <p className="text-sm text-gray-400 mb-6">Comparte tu estilo y conecta con otras amantes de la moda</p>
                  <button
                    onClick={() => setIsPublishModalOpen(true)}
                    className="inline-flex items-center gap-2 bg-primary text-white text-sm font-bold px-6 py-3 rounded-full shadow-lg shadow-primary/30 hover:opacity-90 transition-all active:scale-[0.98]"
                  >
                    <Camera size={16} /> Publicar look
                  </button>
                </div>
              )}

              {feedHasMore && feedLooks.length > 0 && (
                <div className="text-center pt-2">
                  <button
                    onClick={loadMoreFeed}
                    disabled={feedLoadingMore}
                    className="bg-gray-100 text-gray-600 text-xs font-bold px-6 py-2.5 rounded-full hover:bg-gray-200 transition-all disabled:opacity-40"
                  >
                    {feedLoadingMore ? 'Cargando...' : 'Cargar más'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* SHOP TAB (Solo ventas) */}
          {activeTab === 'shop' && (
            <div className="px-4 pb-4 animate-fade-in">
              {/* Category Filters */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
                {['all', 'top', 'bottom', 'shoes', 'outerwear', 'accessories', 'dress', 'swimwear', 'activewear'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setShopFilter(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
                      shopFilter === cat
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-primary/30'
                    }`}
                  >
                    {cat === 'all' ? 'Todo' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
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
                        {(item.userId !== currentUserId && (item as any).user?.id !== currentUserId) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartChat(item); }}
                          className="ml-auto text-[10px] text-primary font-semibold"
                        >
                          Chatear
                        </button>
                      )}
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
                            {fav.look.imageUrl || (fav.look.garments && fav.look.garments.filter(g => !!g).length > 0) ? (
                              <img
                                src={fav.look.imageUrl || fav.look.garments.filter(g => !!g)[0].imageUrl}
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

          {/* TRENDS TAB */}
          {activeTab === 'trends' && (
            <div className="px-4 pb-4 animate-fade-in space-y-6">
              <div className="flex items-center gap-2 mb-2 px-2">
                <Sparkles className="text-primary" size={20} />
                <h2 className="text-lg font-bold text-gray-800">Tendencias Feb 2026</h2>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {fashionTrends.map((trend) => (
                  <div
                    key={trend.id}
                    className="stagger-child bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 group transition-all hover:shadow-lg"
                  >
                    <div className="aspect-[16/9] relative overflow-hidden">
                      <img
                        src={trend.image}
                        alt={trend.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="bg-white/90 backdrop-blur-md text-primary text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm">
                          {trend.category}
                        </span>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-800 text-lg">{trend.title}</h3>
                        <span className="text-[10px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                          {trend.source}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed mb-4">
                        {trend.description}
                      </p>
                      <div className="flex justify-between items-center">
                        <div className="flex flex-wrap gap-2">
                          {trend.tags.map((tag: string) => (
                            <span key={tag} className="text-[10px] font-semibold text-gray-400">
                              #{tag.toLowerCase().replace(/\s+/g, '')}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-3">
                          {trend.link && (
                            <a
                              href={trend.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] font-bold text-gray-400 flex items-center gap-1 hover:text-gray-600 transition-colors"
                            >
                              Leer más <ExternalLink size={12} />
                            </a>
                          )}
                          <button
                            onClick={() => {
                              setSearchQuery(trend.title.split(' ').slice(0, 3).join(' '));
                              setActiveTab('shop');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1.5 rounded-full hover:bg-primary hover:text-white transition-all flex items-center gap-1"
                          >
                            Comprar Estilo <ShoppingBag size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Verified Badge */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 flex-shrink-0">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800">Información Verificada</p>
                  <p className="text-xs text-emerald-600">Estas tendencias se basan en reportes reales de las Fashion Weeks de Febrero 2026.</p>
                </div>
              </div>
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
                              <div className={`max-w-[75%]`}>
                                <div className={`px-3 py-2 rounded-2xl text-xs ${m.senderId === currentUserId ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                                  {m.imageUrl ? (
                                    <img src={m.imageUrl} alt="Adjunto" className="w-full h-auto rounded-xl mb-2" />
                                  ) : null}
                                  {m.content.includes('http') ? (
                                    <a href={m.content} target="_blank" rel="noreferrer" className="text-white underline break-all">
                                      {m.content}
                                    </a>
                                  ) : (
                                    <span>{m.content}</span>
                                  )}
                                </div>
                                {/* Reactions */}
                                {messageReactions[m.id] && messageReactions[m.id].length > 0 && (
                                  <div className="flex gap-1 mt-1 ml-1">
                                    {messageReactions[m.id].map((emoji, idx) => (
                                      <span key={idx} className="text-xs bg-white border border-gray-200 rounded-full px-1.5 py-0.5 shadow-sm">
                                        {emoji}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* Reaction buttons */}
                                <div className="flex gap-1 mt-1 ml-1 opacity-0 hover:opacity-100 transition-opacity">
                                  {['❤️', '👍', '😂', '🔥'].map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleAddReaction(m.id, emoji)}
                                      className="text-xs hover:scale-125 transition-transform"
                                      title="Reaccionar"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {chatAttachment && (
                          <div className="flex items-center justify-between rounded-2xl bg-white border border-gray-200 p-3">
                            <span className="text-xs text-gray-500">Adjunto listo para enviar</span>
                            <button onClick={() => setChatAttachment(null)} className="text-[10px] text-primary font-semibold">Eliminar</button>
                          </div>
                        )}
                        <div className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-2">
                          <button
                            type="button"
                            onClick={handleChatAttach}
                            className="text-primary disabled:text-gray-300"
                          >
                            📎
                          </button>
                          <input
                            ref={chatFileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleChatAttachmentUpload}
                          />
                          <input
                            value={messageInput}
                            onChange={e => setMessageInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleChatSend()}
                            placeholder="Escribe un mensaje..."
                            className="flex-1 bg-transparent text-sm outline-none"
                          />
                          <button
                            onClick={handleChatSend}
                            disabled={!messageInput.trim() && !chatAttachment}
                            className="text-primary disabled:text-gray-300"
                          >
                            <Send size={16} />
                          </button>
                        </div>
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
                  <div key={c.id}>
                    <div className="flex space-x-3">
                      <img
                        src={c.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.userName)}&background=0F4C5C&color=fff`}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                        alt={c.userName}
                      />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-bold text-gray-800 mr-1">{c.userName}</span>
                          <span className="text-gray-600">{c.content}</span>
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] text-gray-400">
                            {new Date(c.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                          </span>
                          <button
                            onClick={() => setReplyToComment(replyToComment?.id === c.id ? null : { id: c.id, name: c.userName })}
                            className="text-[10px] font-semibold text-gray-500 hover:text-primary"
                          >
                            Responder
                          </button>
                        </div>
                      </div>
                    </div>
                    {c.replies && c.replies.length > 0 && (
                      <div className="ml-10 mt-2 space-y-2 border-l-2 border-gray-100 pl-3">
                        {c.replies.map(r => (
                          <div key={r.id} className="flex space-x-2">
                            <img
                              src={r.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.userName)}&background=0F4C5C&color=fff`}
                              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                              alt={r.userName}
                            />
                            <div>
                              <p className="text-sm">
                                <span className="font-bold text-gray-800 mr-1">{r.userName}</span>
                                <span className="text-gray-600">{r.content}</span>
                              </p>
                              <span className="text-[10px] text-gray-400">
                                {new Date(r.createdAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-gray-100">
              {replyToComment && (
                <div className="flex items-center justify-between bg-primary/5 rounded-lg px-3 py-1.5 mb-2">
                  <p className="text-xs text-gray-600">Respondiendo a <span className="font-semibold">{replyToComment.name}</span></p>
                  <button onClick={() => setReplyToComment(null)}><X size={14} className="text-gray-400" /></button>
                </div>
              )}
              <div className="flex items-center space-x-3">
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
                    placeholder={replyToComment ? `Responde a ${replyToComment.name}...` : "Añade un comentario..."}
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
        </div>
      )}

      {/* Story View Modal */}
      {selectedStoryId && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedStoryId(null)}>
          <div className="bg-white w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl animate-pop-in max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 ring-2 ring-primary/20">
                  <img src={stories.find(s => s.id === selectedStoryId)?.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(stories.find(s => s.id === selectedStoryId)?.userName || 'U')}&background=0F4C5C&color=fff`} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{stories.find(s => s.id === selectedStoryId)?.userName}</p>
                  <p className="text-[10px] text-gray-500">{getStoryOwnerBadge(stories.find(s => s.id === selectedStoryId)!)} · {stories.find(s => s.id === selectedStoryId)?.views} vistas</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Delete story button (own stories only) */}
                {(() => {
                  const st = stories.find(s => s.id === selectedStoryId);
                  if (st?.isOwn) {
                    return (
                      <div className="relative">
                        <button
                          onClick={() => setStoryMenuOpenId(storyMenuOpenId === st.id ? null : st.id)}
                          className="text-gray-400 p-2 rounded-full hover:bg-gray-100 transition-colors"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {storyMenuOpenId === st.id && (
                          <div className="absolute right-0 top-10 z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[160px] animate-fade-in">
                            <button
                              onClick={() => { setStoryMenuOpenId(null); setConfirmDelete({ type: 'story', id: st.id }); }}
                              disabled={deletingStoryId === st.id}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                            >
                              {deletingStoryId === st.id ? 'Eliminando...' : 'Eliminar historia'}
                            </button>
                            <button
                              onClick={() => setStoryMenuOpenId(null)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 font-medium hover:bg-gray-50 transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
                <button onClick={() => setSelectedStoryId(null)} className="text-gray-400 p-2 rounded-full hover:bg-gray-100 transition-colors">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-primary/[0.02] to-transparent p-4">
              {(() => {
                const story = stories.find(s => s.id === selectedStoryId);
                if (!story) return null;
                return (
                  <div className="space-y-4 animate-fade-in-up">
                    {story.imageUrl ? (
                      <div className="relative rounded-3xl overflow-hidden">
                        <img src={story.imageUrl} alt="Historia" className="w-full object-cover transition-all duration-500" loading="lazy" />
                        {story.text && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-12">
                            <p className="text-white text-sm font-medium">{story.text}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="min-h-[260px] rounded-3xl bg-gradient-to-br from-primary/10 to-accent/10 p-6 flex items-center justify-center">
                        <p className="text-base text-gray-700 leading-relaxed text-center italic">&ldquo;{story.text}&rdquo;</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                      <span>{new Date(story.createdAt).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-semibold text-xs">{story.views} visualizaciones</span>
                        <div className="flex gap-1">
                          {['❤️', '🔥', '💯', '😍', '👏'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={async () => {
                                addXp(1, 'reaccionar a historia');
                                try {
                                  await api.reactToStory(story.id, emoji);
                                } catch (e) {
                                  console.warn('Could not send reaction message:', e);
                                }
                                setSelectedStoryId(null);
                              }}
                              className="text-lg hover:scale-125 transition-transform active:scale-150"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {!story.isOwn && (
                      <button
                        onClick={() => {
                          setSelectedStoryId(null);
                          handleStartChat(undefined, { user: { id: story.userId, name: story.userName, avatar: story.userAvatar } });
                          setActiveTab('chat');
                        }}
                        className="w-full mt-2 text-xs font-semibold text-primary border border-primary/30 rounded-full py-2 hover:bg-primary hover:text-white transition-all active:scale-[0.98]"
                      >
                        Enviar mensaje
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Create Story Modal */}
      {isCreateStoryOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsCreateStoryOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl animate-pop-in max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Crear nueva historia</h3>
                <p className="text-[12px] text-gray-500">Sube una foto, look o comparte una frase corta.</p>
              </div>
              <button onClick={() => setIsCreateStoryOpen(false)} className="text-gray-400 p-2 rounded-full hover:bg-gray-100 transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto no-scrollbar flex-1">
              <div className="flex gap-2 bg-gray-50 rounded-2xl p-1">
                <button
                  type="button"
                  onClick={() => setStoryForm(prev => ({ ...prev, type: 'image' }))}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${storyForm.type === 'image' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                >
                  Imagen
                </button>
                <button
                  type="button"
                  onClick={() => setStoryForm(prev => ({ ...prev, type: 'text' }))}
                  className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${storyForm.type === 'text' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                >
                  Texto
                </button>
              </div>

              {storyForm.type === 'image' ? (
                <div className="space-y-3 animate-fade-in-up">
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleStoryPhotoPick(CameraSource.Camera)}
                      className="rounded-3xl bg-primary/10 text-primary py-3 font-semibold hover:bg-primary hover:text-white transition-all active:scale-95"
                    >
                      Cámara
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStoryPhotoPick(CameraSource.Photos)}
                      className="rounded-3xl bg-gray-100 text-gray-700 py-3 font-semibold hover:bg-gray-200 transition-all active:scale-95"
                    >
                      Galería
                    </button>
                  </div>
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 overflow-hidden transition-all duration-300 relative">
                    {storyForm.imageUrl ? (
                      <div className="relative">
                        <img src={storyForm.imageUrl} alt="Vista previa" className="w-full object-cover animate-pop-in" style={{ maxHeight: '320px' }} />
                        {storyForm.text && (
                          <div className={`absolute left-0 right-0 px-4 py-3 pointer-events-none ${storyForm.textPosition === 'top' ? 'top-0' : storyForm.textPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-0'}`}>
                            <p className={`text-white font-bold drop-shadow-lg text-center break-words ${
                              storyForm.textSize === 'sm' ? 'text-sm' : storyForm.textSize === 'lg' ? 'text-2xl' : 'text-lg'
                            }`}
                              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
                            >
                              {storyForm.text}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 py-16 text-center">Selecciona una foto para tu historia.</p>
                    )}
                  </div>
                  {storyForm.imageUrl && (
                    <div className="space-y-3 animate-fade-in-up">
                      <input
                        type="text"
                        value={storyForm.text}
                        onChange={e => setStoryForm(prev => ({ ...prev, text: e.target.value }))}
                        placeholder="Añade texto sobre la imagen..."
                        className="w-full rounded-3xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      />
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <p className="text-[10px] text-gray-400 font-semibold mb-1.5 uppercase tracking-wider">Posición</p>
                          <div className="flex gap-1">
                            {(['top', 'center', 'bottom'] as const).map(pos => (
                              <button
                                key={pos}
                                type="button"
                                onClick={() => setStoryForm(prev => ({ ...prev, textPosition: pos }))}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                  storyForm.textPosition === pos ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {pos === 'top' ? 'Arriba' : pos === 'center' ? 'Centro' : 'Abajo'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-gray-400 font-semibold mb-1.5 uppercase tracking-wider">Tamaño</p>
                          <div className="flex gap-1">
                            {(['sm', 'md', 'lg'] as const).map(size => (
                              <button
                                key={size}
                                type="button"
                                onClick={() => setStoryForm(prev => ({ ...prev, textSize: size }))}
                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                  storyForm.textSize === size ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                              >
                                {size === 'sm' ? 'Peq' : size === 'md' ? 'Med' : 'Gde'}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <textarea
                  value={storyForm.text}
                  onChange={e => setStoryForm(prev => ({ ...prev, text: e.target.value }))}
                  placeholder="Escribe tu frase o reflexión..."
                  className="w-full min-h-[160px] rounded-3xl border border-gray-200 p-4 text-sm text-gray-700 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                />
              )}

              <div className="space-y-3">
                <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-[0.2em]">O desde tu armario</p>
                <div className="grid grid-cols-3 gap-2">
                  {garments.slice(0, 6).map(g => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setStoryForm(prev => ({ ...prev, type: 'image', text: g.name, imageUrl: g.imageUrl, selectedGarmentId: g.id, imageFile: null }))}
                      className={`h-24 rounded-3xl overflow-hidden border-2 transition-all duration-200 ${storyForm.selectedGarmentId === g.id ? 'border-primary shadow-md scale-105' : 'border-gray-200 hover:border-primary/30'} bg-white`}
                    >
                      <img src={g.imageUrl} alt={g.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {garments.length === 0 && (
                    <div className="col-span-3 rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-xs text-gray-400">
                      Añade prendas a tu armario y compártelas como historia.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="button"
                  onClick={handlePublishStory}
                  className="w-full rounded-3xl bg-primary text-white px-4 py-3 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  Publicar historia
                </button>
                {storyUploadError && (
                  <p className="text-xs text-rose-500 text-center animate-fade-in">{storyUploadError}</p>
                )}
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

      {/* Challenge Detail & Submission Modal */}
      {showChallengeModal && currentChallenge && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => { setShowChallengeModal(false); setChallengeImage(null); setChallengeDescription(''); setChallengeValidationMsg(null); }}>
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-pop-in max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-bold text-gray-800 text-lg">Subir look del reto</h3>
              <button onClick={() => { setShowChallengeModal(false); setChallengeImage(null); setChallengeDescription(''); setChallengeValidationMsg(null); }} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Challenge info */}
              <div className="bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl p-4 border border-primary/10">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-primary text-sm">{currentChallenge.title}</h4>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">
                    +{currentChallenge.reward} XP
                  </span>
                </div>
                <p className="text-xs text-gray-600">{currentChallenge.description}</p>
              </div>

              {/* Tips section */}
              <div className="bg-amber-50 rounded-2xl p-3 border border-amber-200/50">
                <p className="text-[10px] uppercase tracking-wider text-amber-700 font-semibold mb-2">Consejos para este reto</p>
                <div className="flex flex-wrap gap-1.5">
                  {['Usa tonos similares y buena iluminación', 'Varía texturas para evitar monotonía', 'Busca un fondo limpio', 'Asegura buena luz natural'].map((tip, i) => (
                    <span key={i} className="text-[10px] bg-amber-100/80 text-amber-800 px-2 py-1 rounded-full">{tip}</span>
                  ))}
                </div>
              </div>

              {/* Image picker - Required */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Foto del look <span className="text-rose-500">*</span></p>
                {challengeImage ? (
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 border border-gray-200">
                    <img src={challengeImage.dataUrl} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setChallengeImage(null)}
                      className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleChallengePickImage('camera')}
                      className="w-full aspect-video rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <Camera size={22} />
                      <span className="text-[11px]">Cámara</span>
                    </button>
                    <button
                      onClick={() => handleChallengePickImage('gallery')}
                      className="w-full aspect-video rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <Sparkles size={22} />
                      <span className="text-[11px]">Galería</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Description - Required */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Descripción <span className="text-rose-500">*</span></p>
                <textarea
                  value={challengeDescription}
                  onChange={e => setChallengeDescription(e.target.value)}
                  placeholder="Cuéntanos cómo creaste este look. Mínimo 10 caracteres."
                  rows={3}
                  className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-sm text-gray-700 border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none transition"
                />
                <p className="text-[10px] text-gray-400 mt-1">{challengeDescription.length}/500 {challengeDescription.length > 0 && challengeDescription.length < 10 && <span className="text-amber-500">(mínimo 10)</span>}</p>
              </div>

              {/* Validation message */}
              {challengeValidationMsg && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex items-start gap-2 animate-fade-in">
                  <span className="text-rose-500 text-xs mt-0.5">⚠️</span>
                  <p className="text-xs text-rose-700">{challengeValidationMsg}</p>
                </div>
              )}

              <button
                onClick={handleChallengeSubmit}
                disabled={challengeSubmitting}
                className="w-full rounded-2xl bg-primary text-white py-3 text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {challengeSubmitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</>
                ) : (
                  <><Sparkles size={16} /> Subir look del reto</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Challenge History Modal */}
      {showChallengeHistory && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowChallengeHistory(false)}>
          <div className="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-pop-in max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="font-bold text-gray-800 text-lg">Historial de retos</h3>
              <button onClick={() => setShowChallengeHistory(false)} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {loadingChallengeHistory ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                </div>
              ) : challengeHistory.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                  <Sparkles size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-medium">Aún no hay retos completados</p>
                  <p className="text-xs mt-1">Participa en el reto semanal para verlo aquí</p>
                </div>
              ) : (
                <>
                  <div className="bg-primary/5 rounded-2xl p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Total XP ganado en retos</p>
                    <p className="text-2xl font-bold text-primary">{challengeHistoryXp} XP</p>
                  </div>
                  {challengeHistory.filter((c: any) => c.submissions?.length > 0).map((challenge: any) => {
                    const sub = challenge.submissions[0];
                    return (
                      <div key={challenge.id} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex gap-3">
                        {sub?.imageUrl && (
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                            <img src={sub.imageUrl} alt={challenge.title} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-gray-800 truncate">{challenge.title}</h4>
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              +{challenge.reward} XP
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{sub?.description || challenge.description}</p>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {new Date(challenge.endDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {challengeHistory.filter((c: any) => c.submissions?.length === 0).length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Retos sin participación</p>
                      <div className="flex flex-wrap gap-2">
                        {challengeHistory.filter((c: any) => c.submissions?.length === 0).map((c: any) => (
                          <span key={c.id} className="text-[11px] bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{c.title}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button for Publishing */}
      {activeTab === 'feed' && (
        <button
          onClick={() => setIsPublishModalOpen(true)}
          className="fixed bottom-24 right-5 z-40 bg-primary text-white p-4 rounded-full shadow-lg shadow-primary/30 hover:scale-105 hover:bg-teal-800 transition-all active:scale-95 flex items-center justify-center animate-bounce-soft"
        >
          <Camera size={24} />
        </button>
      )}

      {/* Publish Post Modal (Instagram-style) */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setIsPublishModalOpen(false)}>
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-pop-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg">Nueva publicación</h3>
              <button onClick={() => { setIsPublishModalOpen(false); setPublishPhoto(null); setPublishDescription(''); }} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!publishPhoto ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 text-center">Selecciona una foto para tu publicación</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handlePublishPhotoPick(CameraSource.Camera)}
                      className="flex-1 bg-primary/10 text-primary py-4 rounded-2xl font-semibold hover:bg-primary hover:text-white transition-all active:scale-[0.98]"
                    >
                      Cámara
                    </button>
                    <button
                      onClick={() => handlePublishPhotoPick(CameraSource.Photos)}
                      className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-semibold hover:bg-gray-200 transition-all active:scale-[0.98]"
                    >
                      Galería
                    </button>
                  </div>
                  {publishError && <p className="text-xs text-rose-500 text-center animate-fade-in">{publishError}</p>}
                </div>
              ) : (
                <div className="space-y-4 animate-fade-in-up">
                  <div className="relative rounded-2xl overflow-hidden bg-gray-50">
                    <img src={publishPhoto} alt="Preview" className="w-full max-h-80 object-contain" />
                    <button
                      onClick={() => { setPublishPhoto(null); setPublishPhotoFile(null); }}
                      className="absolute top-2 right-2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <textarea
                    value={publishDescription}
                    onChange={e => setPublishDescription(e.target.value)}
                    placeholder="Escribe una descripción..."
                    rows={3}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  />
                  {publishError && <p className="text-xs text-rose-500 animate-fade-in">{publishError}</p>}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handlePublishPhotoPick(CameraSource.Camera)}
                      className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200 transition-colors"
                    >
                      Cambiar foto
                    </button>
                    <button
                      onClick={handlePublishSubmit}
                      disabled={isPublishing}
                      className="flex-1 bg-primary text-white py-2.5 rounded-xl font-bold hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isPublishing ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Publicando...</>
                      ) : (
                        <><Sparkles size={16} /> Publicar +20 XP</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Click-to-Shop Modal Component */}
      {shopModalLook && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end justify-center animate-fade-in sm:items-center sm:p-4">
          {/* Dismiss area */}
          <div className="absolute inset-0" onClick={() => setShopModalLook(null)} />

          <div className="bg-white w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl relative z-10 animate-slide-up max-h-[85vh] flex flex-col">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto my-3 sm:hidden" />

            <div className="p-5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                  <ShoppingBag size={18} className="text-primary" />
                  Boutique del Look
                </h3>
                <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider mt-1">{shopModalLook.name}</p>
              </div>
              <button onClick={() => setShopModalLook(null)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {shopModalLook.garments?.filter(g => g.forSale).map(g => (
                <div key={g.id} className="flex gap-4 border border-gray-100 p-3 rounded-2xl bg-gray-50/50">
                  <img src={g.imageUrl} className="w-20 h-24 object-cover rounded-xl bg-gray-200" alt={g.name} />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm text-gray-800 truncate pr-2">{g.name}</p>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0">{g.price}€</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 capitalize">{g.brand || 'Varios'} • Talla {g.size || 'Única'}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Vendida por {shopModalLook.userName || 'Usuario'}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShopModalLook(null);
                        handleStartChat(undefined, { ...g, user: { id: shopModalLook.userId, name: shopModalLook.userName, avatar: shopModalLook.userAvatar } });
                      }}
                      className="bg-primary/10 text-primary w-fit text-xs font-bold px-4 py-1.5 rounded-full hover:bg-primary hover:text-white transition-colors mt-2"
                    >
                      Chatear con el vendedor
                    </button>
                  </div>
                </div>
              ))}

              {(!shopModalLook.garments || !shopModalLook.garments.some(g => g.forSale)) && (
                <div className="py-8 text-center text-gray-400">
                  <p>Este look ya no tiene prendas disponibles para la venta.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'post' ? 'Eliminar publicación' : confirmDelete?.type === 'story' ? 'Eliminar historia' : 'Eliminar participación'}
        message="¿Seguro que quieres eliminar esto? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        destructive={true}
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.type === 'post' && confirmDelete.id) handleDeletePost(confirmDelete.id);
          else if (confirmDelete.type === 'story' && confirmDelete.id) handleDeleteStory(confirmDelete.id);
          else if (confirmDelete.type === 'challenge') handleDeleteChallengeSubmission();
          else setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Confetti Overlay */}
      <ConfettiOverlay active={confettiActive} onFinish={() => setConfettiActive(false)} />

      {/* Published bounce animation */}
      {publishedBounce && (
        <div className="fixed inset-0 pointer-events-none z-[85] flex items-start justify-center pt-32" aria-hidden="true">
          <div className="animate-bounce-in bg-primary text-white text-sm font-bold px-6 py-3 rounded-2xl shadow-2xl shadow-primary/40">
            {publishedBounce === 'post' ? '📸 Publicado con éxito' : '✨ Historia publicada'}
          </div>
        </div>
      )}
    </div>
  );
};

export default Social;
