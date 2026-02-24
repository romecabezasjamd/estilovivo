import React, { useEffect, useMemo, useState, useRef } from 'react';
import { MessageCircle, ArrowRight, Send } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { api } from '../services/api';
import { ChatConversation, ChatMessage } from '../types';
import { useLanguage } from '../src/context/LanguageContext';

interface ChatProps {
  onNavigate: (tab: string) => void;
}

const Chat: React.FC<ChatProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messagesById, setMessagesById] = useState<Record<string, ChatMessage[]>>({});
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const currentUserId = useMemo(() => {
    const raw = localStorage.getItem('beyour_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw).id || null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const draftRaw = localStorage.getItem('ev_chat_draft');
    const openId = localStorage.getItem('ev_chat_open');

    const init = async () => {
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
    };

    init();
  }, []);

  useEffect(() => {
    const newSocket = io(process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3000', {
      withCredentials: true,
    });

    setSocket(newSocket);

    newSocket.on('new_message', (message: ChatMessage) => {
      setMessagesById(prev => {
        const threadMessages = prev[message.conversationId] || [];
        if (threadMessages.some(m => m.id === message.id)) return prev;
        return {
          ...prev,
          [message.conversationId]: [...threadMessages, message]
        };
      });

      setConversations(prev => prev.map(c => c.id === message.conversationId
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
      ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()));

      scrollToBottom();
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (socket && conversations.length > 0) {
      conversations.forEach(c => socket.emit('join_room', c.id));
    }
  }, [socket, conversations]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messagesById, selectedThreadId]);

  const activeThread = useMemo(
    () => conversations.find(tThread => tThread.id === selectedThreadId) || null,
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

  const handleSend = () => {
    if (!messageInput.trim() || !activeThread) return;
    const content = messageInput.trim();
    setMessageInput('');

    api.sendConversationMessage(activeThread.id, content)
      .then(() => {
        // Socket event will handle adding the message to the UI in real-time
      })
      .catch((e) => {
        console.warn('Error sending message:', e);
      });
  };

  return (
    <div className="p-6 pb-24 bg-gray-50 min-h-full">
      <header className="flex justify-between items-center mb-6 mt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('messages')}</h1>
          <p className="text-sm text-gray-500">{t('messagesDesc')}</p>
        </div>
      </header>

      {loadingConversations ? (
        <div className="flex justify-center py-16">
          <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center shadow-sm animate-fade-in">
          <MessageCircle size={48} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm">{t('noConversations')}</p>
          <p className="text-xs text-gray-300 mt-1">{t('noConversationsDesc')}</p>
          <button
            onClick={() => onNavigate('community')}
            className="mt-4 inline-flex items-center gap-2 text-primary text-sm font-semibold"
          >
            {t('goToCommunity')}
            <ArrowRight size={14} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-220px)]">
          <div className="w-full md:w-1/3 bg-white rounded-3xl border border-gray-100 overflow-y-auto no-scrollbar shadow-sm">
            <div className="divide-y divide-gray-100">
              {conversations.map(tThread => (
                <button
                  key={tThread.id}
                  onClick={() => setSelectedThreadId(tThread.id)}
                  className={`w-full flex items-center gap-3 p-4 text-left transition ${selectedThreadId === tThread.id ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                >
                  <img
                    src={tThread.otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(tThread.otherUser?.name || 'U')}&background=0F4C5C&color=fff`}
                    className="w-10 h-10 rounded-full object-cover"
                    alt={tThread.otherUser?.name}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{tThread.otherUser?.name || 'Usuario'}</p>
                    <p className="text-[11px] text-gray-400 truncate">{tThread.itemTitle || 'Conversacion'}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 truncate max-w-[120px]">{tThread.lastMessage?.content || ''}</span>
                </button>
              ))}
            </div>
          </div>

          {activeThread && (
            <div className="w-full md:w-2/3 bg-white rounded-3xl border border-gray-100 shadow-sm p-4 flex flex-col relative h-full">
              <div className="flex items-center justify-between gap-3 mb-4 pb-4 border-b border-gray-50 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <img
                    src={activeThread.otherUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeThread.otherUser?.name || 'U')}&background=0F4C5C&color=fff`}
                    className="w-10 h-10 rounded-full object-cover"
                    alt={activeThread.otherUser?.name}
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{activeThread.otherUser?.name || 'Usuario'}</p>
                    <p className="text-[11px] text-gray-400 truncate">{activeThread.itemTitle || 'Conversacion'}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 mb-4 pb-2">
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
                <div ref={messagesEndRef} />
              </div>

              <div className="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-2 flex-shrink-0">
                <input
                  value={messageInput}
                  onChange={e => setMessageInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={t('typeMessage')}
                  className="flex-1 bg-transparent text-sm outline-none px-2"
                />
                <button
                  onClick={handleSend}
                  disabled={!messageInput.trim()}
                  className="bg-primary text-white p-2 rounded-full disabled:bg-gray-300 disabled:opacity-50 transition-colors shadow-sm"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Chat;
