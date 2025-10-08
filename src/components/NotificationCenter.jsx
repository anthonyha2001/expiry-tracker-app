import React, { useState, useRef, useEffect } from 'react';
import { useInventory } from '../hooks/useInventory.js';
import { Bell, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const NotificationCenter = () => {
    const { notifications, markNotificationAsRead } = useInventory();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    
    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="notification-center" ref={dropdownRef}>
            <button className="notification-bell" onClick={() => setIsOpen(!isOpen)}>
                <Bell size={22} />
                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>
            {isOpen && (
                <div className="notification-panel">
                    <div className="notification-header">
                        <h3>Notifications</h3>
                    </div>
                    <div className="notification-list">
                        {notifications.length > 0 ? (
                            notifications.map(n => (
                                <div key={n.id} className={`notification-item ${!n.read ? 'unread' : ''}`}>
                                    <div className="notification-content">
                                        <p>{n.content}</p>
                                        <span className="notification-date">
                                            {formatDistanceToNow(new Date(n.date), { addSuffix: true })}
                                        </span>
                                    </div>
                                    {!n.read && (
                                        <button className="mark-read-btn" title="Mark as read" onClick={() => markNotificationAsRead(n.id)}>
                                            <Check size={16} />
                                        </button>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="no-notifications">No notifications yet.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationCenter;
