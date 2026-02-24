export interface Garment {
  id: string;
  imageUrl: string;
  name: string;
  type: string;
  color: string;
  season: 'summer' | 'winter' | 'all' | 'transition';
  usageCount: number;
  lastWorn?: string;
  forSale?: boolean;
  price?: number;
  brand?: string;
  size?: string;
  condition?: string;
  description?: string;
  isWashing?: boolean;
  userId?: string;
  userName?: string;
  userAvatar?: string;
}

export interface Look {
  id: string;
  name: string;
  garmentIds: string[];
  garments?: Garment[];
  tags: string[];
  mood?: string;
  createdAt: string;
  isPublic?: boolean;
  imageUrl?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  isFavorited?: boolean;
}

export interface Comment {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: string;
}

export interface PlannerEntry {
  date: string; // "YYYY-MM-DD"
  lookId: string | null;
  look?: Look;
  eventId?: string;
  eventNote?: string;
}

export interface UserState {
  id?: string;
  email?: string;
  name: string;
  mood: string | null;
  cycleTracking: boolean;
  musicSync: boolean;
  bio: string;
  avatar?: string;
  followersCount?: number;
  followingCount?: number;
  gender?: 'male' | 'female' | 'other';
  birthDate?: string;
}

export interface MoodOption {
  id: string;
  label: string;
  emoji: string;
  colorClass: string;
}

export interface TripItem {
  id: string;
  label: string;
  checked: boolean;
  isEssential: boolean;
}

export interface Trip {
  id: string;
  destination: string;
  dateStart: string;
  dateEnd: string;
  items: TripItem[];
  garments?: Garment[];
}

export interface CommunityPost {
  id: string;
  user: string;
  userId: string;
  avatar: string;
  image: string;
  mood: string;
  desc: string;
  likes: number;
  comments: number;
  isLiked: boolean;
  isFavorited: boolean;
  createdAt: string;
}

export interface ShopItem {
  id: string;
  user: string;
  userId: string;
  avatar: string;
  image: string;
  title: string;
  price: number;
  size: string;
  brand: string;
  condition: string;
}

export interface ChatParticipant {
  id: string;
  name: string;
  avatar?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: ChatParticipant;
}

export interface ChatConversation {
  id: string;
  itemId?: string | null;
  itemTitle?: string | null;
  itemImage?: string | null;
  itemOwnerId?: string | null;
  updatedAt: string;
  lastMessage?: { id: string; content: string; createdAt: string; sender?: ChatParticipant } | null;
  participants: ChatParticipant[];
  otherUser?: ChatParticipant | null;
}