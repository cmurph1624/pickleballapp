import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, IconButton, Typography, CircularProgress, Divider } from '@mui/material';
import { Send, ArrowBack } from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, arrayRemove, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import MessageItem from './MessageItem';

const MessageList = ({ channel, onOpenThread, onBack }) => {
    const { currentUser } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!channel) return;

        setLoading(true);
        const q = query(
            collection(db, 'channels', channel.id, 'messages'),
            orderBy('createdAt', 'asc'),
            limit(50) // MVP limit
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setMessages(msgs);
            setLoading(false);
            // Scroll to bottom on new messages
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        return () => unsubscribe();
    }, [channel]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !currentUser) return;

        const text = newMessage.trim();
        setNewMessage('');

        try {
            // Add message
            await addDoc(collection(db, 'channels', channel.id, 'messages'), {
                text: text,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'User',
                senderPhotoURL: currentUser.photoURL,
                createdAt: serverTimestamp(),
                reactions: {},
                threadCount: 0
            });

            // Update channel last message
            await updateDoc(doc(db, 'channels', channel.id), {
                lastMessage: {
                    text: text,
                    senderId: currentUser.uid,
                    senderName: currentUser.displayName || 'User'
                },
                lastMessageAt: serverTimestamp()
            });

        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const handleAddReaction = async (messageId, emoji) => {
        if (!currentUser) return;

        const messageRef = doc(db, 'channels', channel.id, 'messages', messageId);
        const message = messages.find(m => m.id === messageId);

        if (!message) return;

        const currentReactions = message.reactions || {};
        const userIds = currentReactions[emoji] || [];

        if (userIds.includes(currentUser.uid)) {
            // Remove reaction
            // Note: Firestore map updates with arrayRemove are tricky, 
            // simpler to read, modify, write for nested maps or use dot notation if key is known
            // But key is dynamic (emoji). 
            // For MVP, let's just update the whole map field.
            const updatedUserIds = userIds.filter(id => id !== currentUser.uid);
            const updatedReactions = { ...currentReactions };
            if (updatedUserIds.length === 0) {
                delete updatedReactions[emoji];
            } else {
                updatedReactions[emoji] = updatedUserIds;
            }
            await updateDoc(messageRef, { reactions: updatedReactions });
        } else {
            // Add reaction
            const updatedReactions = {
                ...currentReactions,
                [emoji]: [...userIds, currentUser.uid]
            };
            await updateDoc(messageRef, { reactions: updatedReactions });
        }
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', gap: 1 }}>
                {onBack && (
                    <IconButton onClick={onBack} edge="start">
                        <ArrowBack />
                    </IconButton>
                )}
                <Typography variant="h6">
                    {channel.type === 'public' ? '#' : ''} {channel.name}
                </Typography>
            </Box>

            {/* Messages Area */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    messages.map(msg => (
                        <MessageItem
                            key={msg.id}
                            message={msg}
                            onAddReaction={handleAddReaction}
                            onOpenThread={onOpenThread}
                        />
                    ))
                )}
                <div ref={messagesEndRef} />
            </Box>

            {/* Input Area */}
            <Box component="form" onSubmit={handleSendMessage} sx={{ p: 2, borderTop: '1px solid #eee', display: 'flex', gap: 1 }}>
                <TextField
                    fullWidth
                    placeholder={`Message ${channel.type === 'public' ? '#' : ''}${channel.name}`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    size="small"
                    autoComplete="off"
                />
                <IconButton type="submit" color="primary" disabled={!newMessage.trim()}>
                    <Send />
                </IconButton>
            </Box>
        </Box>
    );
};

export default MessageList;
