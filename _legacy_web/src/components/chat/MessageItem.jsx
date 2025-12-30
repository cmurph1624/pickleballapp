import React, { useState } from 'react';
import { Box, Typography, Avatar, IconButton, Tooltip, Popover, Paper } from '@mui/material';
import { AddReaction, Reply, Delete } from '@mui/icons-material';
import EmojiPicker from 'emoji-picker-react';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

const MessageItem = ({ message, onAddReaction, onOpenThread, onDelete }) => {
    const { currentUser } = useAuth();
    const [anchorEl, setAnchorEl] = useState(null);
    const [isHovered, setIsHovered] = useState(false);

    const handleEmojiClick = (emojiData) => {
        onAddReaction(message.id, emojiData.emoji);
        setAnchorEl(null);
    };

    const isOwnMessage = currentUser && message.senderId === currentUser.uid;

    return (
        <Box
            sx={{
                display: 'flex',
                gap: 2,
                p: 1,
                '&:hover': { bgcolor: 'action.hover' },
                position: 'relative'
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Avatar src={message.senderPhotoURL} alt={message.senderName}>
                {message.senderName?.charAt(0)}
            </Avatar>

            <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {message.senderName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {message.createdAt?.seconds ? format(new Date(message.createdAt.seconds * 1000), 'h:mm a') : 'Sending...'}
                    </Typography>
                </Box>

                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {message.text}
                </Typography>

                {/* Reactions Display */}
                {message.reactions && Object.keys(message.reactions).length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        {Object.entries(message.reactions).map(([emoji, userIds]) => (
                            <Box
                                key={emoji}
                                onClick={() => onAddReaction(message.id, emoji)}
                                sx={{
                                    bgcolor: userIds.includes(currentUser?.uid) ? 'primary.light' : 'action.selected',
                                    borderRadius: 4,
                                    px: 0.8,
                                    py: 0.2,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    border: '1px solid transparent',
                                    borderColor: userIds.includes(currentUser?.uid) ? 'primary.main' : 'transparent'
                                }}
                            >
                                <span>{emoji}</span>
                                <span style={{ fontSize: '0.7rem' }}>{userIds.length}</span>
                            </Box>
                        ))}
                    </Box>
                )}

                {/* Thread Indicator */}
                {message.threadCount > 0 && (
                    <Box
                        onClick={() => onOpenThread(message)}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mt: 0.5,
                            cursor: 'pointer',
                            width: 'fit-content'
                        }}
                    >
                        <Avatar
                            src={message.latestThreadSenderPhoto}
                            sx={{ width: 16, height: 16 }}
                        />
                        <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                            {message.threadCount} replies
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Last reply {message.latestThreadMessageAt?.seconds ? format(new Date(message.latestThreadMessageAt.seconds * 1000), 'h:mm a') : ''}
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Hover Actions */}
            {isHovered && (
                <Paper
                    elevation={3}
                    sx={{
                        position: 'absolute',
                        right: 16,
                        top: -10,
                        display: 'flex',
                        borderRadius: 2,
                        overflow: 'hidden'
                    }}
                >
                    <Tooltip title="Add Reaction">
                        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
                            <AddReaction fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Reply in Thread">
                        <IconButton size="small" onClick={() => onOpenThread(message)}>
                            <Reply fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    {isOwnMessage && onDelete && (
                        <Tooltip title="Delete Message">
                            <IconButton size="small" color="error" onClick={() => onDelete(message.id)}>
                                <Delete fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Paper>
            )}

            <Popover
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <EmojiPicker onEmojiClick={handleEmojiClick} />
            </Popover>
        </Box>
    );
};

export default MessageItem;
