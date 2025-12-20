import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, IconButton, Typography, CircularProgress, Divider } from '@mui/material';
import { Send, Close, ArrowBack } from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import MessageItem from './MessageItem';

const ThreadView = ({ parentMessage, channelId, onClose, onBack }) => {
    const { currentUser } = useAuth();
    const [replies, setReplies] = useState([]);
    const [newReply, setNewReply] = useState('');
    const [loading, setLoading] = useState(true);
    const repliesEndRef = useRef(null);

    useEffect(() => {
        if (!parentMessage || !channelId) return;

        setLoading(true);
        const q = query(
            collection(db, 'channels', channelId, 'messages', parentMessage.id, 'thread'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setReplies(msgs);
            setLoading(false);
            setTimeout(() => {
                repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        });

        return () => unsubscribe();
    }, [parentMessage, channelId]);

    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!newReply.trim() || !currentUser) return;

        const text = newReply.trim();
        setNewReply('');

        try {
            // Add reply
            await addDoc(collection(db, 'channels', channelId, 'messages', parentMessage.id, 'thread'), {
                text: text,
                senderId: currentUser.uid,
                senderName: currentUser.displayName || 'User',
                senderPhotoURL: currentUser.photoURL,
                createdAt: serverTimestamp(),
                reactions: {}
            });

            // Update parent message thread count
            await updateDoc(doc(db, 'channels', channelId, 'messages', parentMessage.id), {
                threadCount: increment(1),
                latestThreadMessageAt: serverTimestamp(),
                latestThreadSenderPhoto: currentUser.photoURL
            });

        } catch (error) {
            console.error("Error sending reply:", error);
        }
    };

    const handleAddReaction = async (messageId, emoji) => {
        if (!currentUser) return;

        const messageRef = doc(db, 'channels', channelId, 'messages', parentMessage.id, 'thread', messageId);
        const message = replies.find(m => m.id === messageId);

        if (!message) return;

        const currentReactions = message.reactions || {};
        const userIds = currentReactions[emoji] || [];

        if (userIds.includes(currentUser.uid)) {
            const updatedUserIds = userIds.filter(id => id !== currentUser.uid);
            const updatedReactions = { ...currentReactions };
            if (updatedUserIds.length === 0) {
                delete updatedReactions[emoji];
            } else {
                updatedReactions[emoji] = updatedUserIds;
            }
            await updateDoc(messageRef, { reactions: updatedReactions });
        } else {
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
            <Box sx={{ p: 2, borderBottom: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {onBack && (
                        <IconButton onClick={onBack} edge="start">
                            <ArrowBack />
                        </IconButton>
                    )}
                    <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Thread</Typography>
                </Box>
                {!onBack && (
                    <IconButton onClick={onClose} size="small">
                        <Close />
                    </IconButton>
                )}
            </Box>

            {/* Parent Message Preview */}
            <Box sx={{ p: 2, bgcolor: 'action.hover', borderBottom: '1px solid #eee' }}>
                <MessageItem message={parentMessage} onAddReaction={() => { }} onOpenThread={() => { }} />
            </Box>

            {/* Replies Area */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                        <CircularProgress />
                    </Box>
                ) : (
                    replies.map(msg => (
                        <MessageItem
                            key={msg.id}
                            message={msg}
                            onAddReaction={handleAddReaction}
                            onOpenThread={() => { }} // No nested threads
                        />
                    ))
                )}
                <div ref={repliesEndRef} />
            </Box>

            {/* Input Area */}
            <Box component="form" onSubmit={handleSendReply} sx={{ p: 2, borderTop: '1px solid #eee', display: 'flex', gap: 1 }}>
                <TextField
                    fullWidth
                    placeholder="Reply..."
                    value={newReply}
                    onChange={(e) => setNewReply(e.target.value)}
                    size="small"
                    autoComplete="off"
                />
                <IconButton type="submit" color="primary" disabled={!newReply.trim()}>
                    <Send />
                </IconButton>
            </Box>
        </Box>
    );
};

export default ThreadView;
