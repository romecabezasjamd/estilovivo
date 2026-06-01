import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { API_BASE, getAuthHeader, getSocketOrigin, parseApiErrorMessage } from '../services/api';

const AUTH_TOKEN_KEY = 'beyour_token';
import { useLanguage } from '../src/context/LanguageContext';

interface Notification {
    id: string;
    type: string;
    content: string;
    isRead: boolean;
    createdAt: string;
    relatedId?: string | null;
    data?: { conversationId?: string } | null;
}

const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const { t } = useLanguage();

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await fetch(`${API_BASE}/notifications`, {
                    credentials: 'include',
                    headers: getAuthHeader() as HeadersInit,
                });
                if (res.ok) {
                    const data = await res.json();
                    setNotifications(data);
                    setFetchError(null);
                } else {
                    setFetchError(await parseApiErrorMessage(res));
                }
            } catch (e) {
                console.error('Error fetching notifications', e);
                setFetchError('No se pudieron cargar las notificaciones');
            }
        };

        const hasSession = localStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem('beyour_user');
        if (hasSession) fetchNotifications();

        const newSocket = io(getSocketOrigin(), {
            withCredentials: true,
            autoConnect: true
        });

        setSocket(newSocket);

        const userStr = localStorage.getItem('beyour_user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.id) {
                    newSocket.emit('join_user', user.id);
                }
            } catch (e) { }
        }

        newSocket.on('notification', (notif: Notification) => {
            setNotifications(prev => [notif, ...prev]);
        });

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const handleNotificationClick = async (notif: Notification, e: React.MouseEvent) => {
        e.stopPropagation();
        
        // Mark as read
        if (!notif.isRead) {
            try {
                await fetch(`${API_BASE}/notifications/${notif.id}/read`, {
                    method: 'PUT',
                    credentials: 'include',
                    headers: getAuthHeader() as HeadersInit,
                });
                setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
            } catch (err) {
                console.error(err);
            }
        }
        
        // Navigate based on notification type
        if (notif.type === 'CHAT') {
            const conversationId = notif.relatedId || notif.data?.conversationId;
            if (conversationId) {
                localStorage.setItem('ev_chat_open', conversationId);
            }
            setIsOpen(false);
            window.dispatchEvent(new CustomEvent('navigateTo', { detail: { tab: 'social', subTab: 'chat' } }));
        } else if (notif.type === 'LIKE' || notif.type === 'COMMENT') {
            setIsOpen(false);
            window.dispatchEvent(new CustomEvent('navigateTo', { detail: { tab: 'social', subTab: 'feed' } }));
        } else if (notif.type === 'FOLLOW') {
            setIsOpen(false);
            window.dispatchEvent(new CustomEvent('navigateTo', { detail: { tab: 'profile' } }));
        } else {
            setIsOpen(false);
        }
    };

    const handleClickOutside = () => setIsOpen(false);

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'CHAT': return '\uD83D\uDCAC';
            case 'LIKE': return '\u2764\uFE0F';
            case 'COMMENT': return '\uD83D\uDCAD';
            case 'FOLLOW': return '\uD83D\uDC64';
            default: return '\uD83D\uDD14';
        }
    };

    return (
        <div className="fixed top-6 right-6 z-[100]">
            <div className="relative">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-11 h-11 bg-white/90 backdrop-blur-md border border-gray-100 shadow-md rounded-full flex items-center justify-center relative hover:bg-white transition-colors"
                >
                    <Bell size={20} className="text-gray-700" />
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>

                {isOpen && (
                    <>
                        <div className="fixed inset-0 z-[-1]" onClick={handleClickOutside} />
                        <div className="absolute top-14 right-0 w-80 bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-pop-in origin-top-right">
                            <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                                <h3 className="font-bold text-gray-800">Notificaciones</h3>
                                {unreadCount > 0 && <span className="text-xs text-primary font-bold bg-primary/10 px-2 py-1 rounded-full">{unreadCount} nuevas</span>}
                            </div>
                            <div className="max-h-96 overflow-y-auto no-scrollbar">
                                {fetchError ? (
                                    <div className="p-6 text-center text-red-500 text-sm">
                                        {fetchError}
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        No tienes notificaciones recientes
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {notifications.map(notif => (
                                            <div
                                                key={notif.id}
                                                onClick={(e) => handleNotificationClick(notif, e)}
                                                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.isRead ? 'bg-primary/5' : ''}`}
                                            >
                                                <div className="flex gap-3">
                                                    <span className="text-base flex-shrink-0 mt-0.5">{getNotificationIcon(notif.type)}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm leading-snug ${!notif.isRead ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                                            {notif.content}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                                                            {new Date(notif.createdAt).toLocaleDateString()} a las {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                    {!notif.isRead && (
                                                        <div className="w-2 h-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default NotificationBell;
