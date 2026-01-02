import React, { useState, useRef, useEffect } from 'react';
import { Fab, Paper, IconButton, TextField, Typography, Box, CircularProgress } from '@mui/material';
import ChatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { auth } from '../firebase';

const ChatWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'model', text: 'Hi! I can help you manage players and sessions. What would you like to do?' }
    ]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const toggleChat = () => {
        setIsOpen(!isOpen);
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!inputText.trim() || isLoading) return;

        const userMessageText = inputText.trim();
        const newUserMessage = { role: 'user', text: userMessageText };

        // Add user message to UI immediately
        setMessages(prev => [...prev, newUserMessage]);
        setInputText('');
        setIsLoading(true);

        try {
            // Prepare history for API (all messages BEFORE this new one)
            // Map to Gemini format: { role: 'user' | 'model', parts: [{ text: '...' }] }
            const history = messages.map(msg => ({
                role: msg.role,
                parts: [{ text: msg.text }]
            }));

            const response = await fetch('https://us-central1-pickleball-268d5.cloudfunctions.net/chat_agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
                },
                body: JSON.stringify({
                    message: userMessageText,
                    history: history
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
            }

            const responseText = await response.text();

            const modelMessage = { role: 'model', text: responseText };
            setMessages(prev => [...prev, modelMessage]);

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [...prev, { role: 'model', text: 'Sorry, something went wrong. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {/* Floating Chat Button */}
            <div className="fixed bottom-4 right-4 z-50">
                <button
                    onClick={toggleChat}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
                    aria-label="Toggle chat"
                >
                    {isOpen ? <CloseIcon /> : <ChatIcon />}
                </button>
            </div>

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-20 right-4 w-80 sm:w-96 h-[32rem] bg-sidebar-dark rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10 z-50 animate-fade-in-up text-white">
                    {/* Header */}
                    <div className="bg-sidebar-dark text-white p-4 flex items-center justify-between shadow-md border-b border-white/10">
                        <div className="flex items-center space-x-2">
                            <SmartToyIcon fontSize="small" className="text-blue-400" />
                            <h3 className="font-semibold text-lg">Assistant</h3>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="hover:bg-white/10 rounded-full p-1 transition-colors"
                        >
                            <CloseIcon fontSize="small" />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background-dark/50 custom-scrollbar">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${msg.role === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-white/10 text-gray-100 border border-white/5 rounded-bl-none'
                                        }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start w-full">
                                <div className="bg-white/10 text-gray-100 border border-white/5 rounded-2xl rounded-bl-none px-4 py-2 text-sm shadow-sm flex items-center space-x-1">
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendMessage} className="p-3 bg-sidebar-dark border-t border-white/10">
                        <div className="flex items-center space-x-2">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-white/5 border border-white/10 text-white placeholder-gray-400 rounded-full px-4 py-2 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!inputText.trim() || isLoading}
                                className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center"
                            >
                                <SendIcon fontSize="small" />
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};

export default ChatWidget;
