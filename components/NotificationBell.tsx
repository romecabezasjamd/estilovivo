import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useLanguage } from '../src/context/LanguageContext';

interface Notification {
    id: string;
    type: string;
    content: string;
    isRead: boolean;
    createdAt: string;
}

const NotificationBell: React.FC = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    const { t } = useLanguage();

    useEffect(() => {
        // Fetch initial notifications
        const fetchNotifications = async () => {
            try {
                const res = await fetch('/api/notifications', { credentials: 'include' });
                if (res.ok) {
                    const data = await res.json();
                    setNotifications(data);
                }
            } catch (e) {
                console.error('Error fetching notifications', e);
            }
        };

        const hasSession = localStorage.getItem('beyour_user');
        if (hasSession) fetchNotifications();

        // Setup Socket
        const newSocket = io(process.env.NODE_ENV === 'production' ? window.location.origin : 'http://localhost:3000', {
            withCredentials: true,
            autoConnect: true
        });

        setSocket(newSocket);

        // Get user id from localStorage session
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

    const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`/api/notifications/${id}/read`, {
                method: 'PUT',
                credentials: 'include'
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (e) {
            console.error(e);
        }
    };

    const handleClickOutside = () => setIsOpen(false);

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
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 text-sm">
                                        No tienes notificaciones recientes
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-50">
                                        {notifications.map(notif => (
                                            <div
                                                key={notif.id}
                                                onClick={(e) => { if (!notif.isRead) handleMarkAsRead(notif.id, e); }}
                                                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.isRead ? 'bg-primary/5' : ''}`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${!notif.isRead ? 'bg-primary' : 'bg-transparent'}`} />
                                                    <div>
                                                        <p className={`text-sm leading-snug ${!notif.isRead ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                                            {notif.content}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 mt-1.5 font-medium">
                                                            {new Date(notif.createdAt).toLocaleDateString()} a las {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
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
