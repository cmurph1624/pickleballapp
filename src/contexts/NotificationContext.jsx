import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => {
    return useContext(NotificationContext);
};

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const { currentUser } = useAuth();

    // Load notifications from local storage on mount
    useEffect(() => {
        const savedNotifications = localStorage.getItem('notifications');
        if (savedNotifications) {
            try {
                const parsed = JSON.parse(savedNotifications);
                setNotifications(parsed);
            } catch (e) {
                console.error("Failed to parse notifications", e);
            }
        }
    }, []);

    // Sync with Firestore for the current user
    useEffect(() => {
        let unsubscribe = () => { };

        if (currentUser) {
            const q = query(
                collection(db, 'notifications'),
                where('userId', '==', currentUser.uid)
            );

            unsubscribe = onSnapshot(q, (snapshot) => {
                const remoteNotifications = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    isRemote: true
                }));

                setNotifications(prev => {
                    const localOnly = prev.filter(n => !n.isRemote);
                    // Merge and sort
                    const merged = [...remoteNotifications, ...localOnly];
                    return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                });
            });
        }

        return () => unsubscribe();
    }, [currentUser]);

    // Save LOCAL notifications to local storage
    useEffect(() => {
        const localNotifications = notifications.filter(n => !n.isRemote);
        localStorage.setItem('notifications', JSON.stringify(localNotifications));
    }, [notifications]);

    const addNotification = async (message, type = 'info', targetUserId = null) => {
        if (targetUserId) {
            try {
                await addDoc(collection(db, 'notifications'), {
                    userId: targetUserId,
                    message,
                    type,
                    read: false,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error("Error sending notification:", error);
            }
        } else {
            const newNotification = {
                id: Date.now().toString(),
                message,
                type,
                read: false,
                timestamp: new Date().toISOString(),
                isRemote: false
            };
            setNotifications((prev) => [newNotification, ...prev].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
        }
    };

    const markAsRead = async (id) => {
        const notification = notifications.find(n => n.id === id);
        if (notification && notification.isRemote) {
            try {
                const notifRef = doc(db, 'notifications', id);
                await updateDoc(notifRef, { read: true });
            } catch (error) {
                console.error("Error marking notification as read:", error);
            }
        } else {
            setNotifications((prev) =>
                prev.map((notif) =>
                    notif.id === id ? { ...notif, read: true } : notif
                )
            );
        }
    };

    const markAllAsRead = async () => {
        // Optimistic local update
        setNotifications((prev) =>
            prev.map((notif) => ({ ...notif, read: true }))
        );

        // Update remote ones
        const unreadRemote = notifications.filter(n => n.isRemote && !n.read);
        unreadRemote.forEach(async (n) => {
            try {
                const notifRef = doc(db, 'notifications', n.id);
                await updateDoc(notifRef, { read: true });
            } catch (error) {
                console.error("Error marking all as read:", error);
            }
        });
    };

    const clearNotifications = async () => {
        // 1. Separate local and remote
        const remoteNotifications = notifications.filter(n => n.isRemote);

        // 2. Delete remote from Firestore
        const deletePromises = remoteNotifications.map(n =>
            deleteDoc(doc(db, 'notifications', n.id)).catch(err => console.error(`Error deleting notification ${n.id}`, err))
        );

        try {
            await Promise.all(deletePromises);
        } catch (error) {
            console.error("Error clearing notifications:", error);
        }

        // 3. Clear local state (which clears local storage via effect)
        setNotifications([]);
    };

    const removeNotification = async (id) => {
        const notification = notifications.find(n => n.id === id);
        if (notification && notification.isRemote) {
            try {
                await deleteDoc(doc(db, 'notifications', id));
            } catch (e) {
                console.error("Error deleting notification", e);
            }
        } else {
            setNotifications((prev) => prev.filter(n => n.id !== id));
        }
    }

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <NotificationContext.Provider
            value={{
                notifications,
                addNotification,
                markAsRead,
                markAllAsRead,
                clearNotifications,
                removeNotification,
                unreadCount,
            }}
        >
            {children}
        </NotificationContext.Provider>
    );
};
