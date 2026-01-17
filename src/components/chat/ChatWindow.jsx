import React, { useState, useEffect, useRef } from 'react';
import {
    TextField,
    IconButton,
    CircularProgress
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useClub } from '../../contexts/ClubContext';
import { useAuth } from '../../contexts/AuthContext';
import { subscribeToMessages, sendMessage } from '../../services/ChatService';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

const ChatWindow = ({ channel }) => {
    const { currentUser } = useAuth();
    const { isAdmin } = useClub(); // Get admin status
    // ... (state)

    // ... (logic)

    const handleDeleteChannel = async () => {
        if (!channel || !window.confirm("Are you sure you want to delete this chat history? This action cannot be undone.")) return;
        try {
            await deleteDoc(doc(db, 'channels', channel.id));
            alert("Channel deleted");
        } catch (error) {
            console.error("Delete failed", error);
            alert("Delete failed: " + error.message);
        }
    };

    // ...

    return (
        <div className="flex flex-col h-full bg-background-dark/30 backdrop-blur-md rounded-r-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex flex-row justify-between items-center">
                <div className="flex flex-col">
                    <h2 className="text-lg font-bold text-white tracking-wide">{channel.metadata?.name || 'Chat'}</h2>
                    {channel.metadata?.location && (
                        <span className="text-xs text-secondary font-medium tracking-wider uppercase">{channel.metadata.location}</span>
                    )}
                </div>
                {/* Delete Button (Admins only) */}
                {isAdmin && (
                    <button
                        onClick={handleDeleteChannel}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-white/10 rounded-full transition-colors"
                        title="Delete Chat History"
                    >
                        <span className="material-symbols-outlined">delete</span>
                    </button>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <CircularProgress color="secondary" />
                    </div>
                ) : (
                    <>
                        {messages.length === 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
                                <span className="material-symbols-outlined text-4xl mb-2">chat_bubble_outline</span>
                                <p>No messages yet. Be the first to say hello!</p>
                            </div>
                        )}
                        {messages.map((msg, index) => {
                            const prevMsg = messages[index - 1];
                            const isSameSender = prevMsg && prevMsg.senderId === msg.senderId;

                            // Check time difference (e.g., 5 minutes)
                            const isNearTime = prevMsg && (msg.timestamp?.seconds - prevMsg.timestamp?.seconds) < 300;

                            const showHeader = !isSameSender || !isNearTime;

                            // Avatar content (First letter of name)
                            const avatarLetter = (msg.senderName || '?')[0].toUpperCase();

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex w-full group hover:bg-white/5 -mx-6 px-6 py-1 ${showHeader ? 'mt-3' : 'mt-0.5'}`}
                                >
                                    {/* Avatar Column */}
                                    <div className="w-10 flex-shrink-0 mr-3">
                                        {showHeader ? (
                                            <div className="w-9 h-9 rounded-md bg-gradient-to-br from-gray-700 to-gray-600 flex items-center justify-center text-white font-bold shadow-sm">
                                                {avatarLetter}
                                            </div>
                                        ) : (
                                            <div className="w-9 text-[10px] text-gray-600 text-center opacity-0 group-hover:opacity-100 pt-1">
                                                {msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </div>
                                        )}
                                    </div>

                                    {/* Content Column */}
                                    <div className="flex-1 flex flex-col min-w-0">
                                        {showHeader && (
                                            <div className="flex items-baseline mb-0.5">
                                                <span className="font-bold text-gray-200 mr-2 text-[15px]">
                                                    {msg.senderName}
                                                </span>
                                                <span className="text-xs text-gray-500">
                                                    {msg.timestamp?.seconds ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'}
                                                </span>
                                            </div>
                                        )}

                                        <div className="text-gray-300 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
                                            {msg.content}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/5 border-t border-white/5">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        className="w-full bg-sidebar-dark text-white placeholder-gray-500 rounded-full py-3 pl-5 pr-12 border border-white/10 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all shadow-inner"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim()}
                        className={`
                            absolute right-2 p-2 rounded-full transition-all
                            ${newMessage.trim()
                                ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/30'
                                : 'bg-transparent text-gray-600 cursor-not-allowed'
                            }
                        `}
                    >
                        <span className="material-symbols-outlined text-xl">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatWindow;
