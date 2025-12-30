import React, { useState, useEffect } from 'react';
import { Box, Paper, useMediaQuery, useTheme } from '@mui/material';
import ChannelList from '../components/chat/ChannelList';
import MessageList from '../components/chat/MessageList';
import ThreadView from '../components/chat/ThreadView';
import { useAuth } from '../contexts/AuthContext';

const Chat = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { currentUser } = useAuth();

    const [selectedChannel, setSelectedChannel] = useState(null);
    const [activeThread, setActiveThread] = useState(null);
    const [mobileView, setMobileView] = useState('list'); // 'list', 'chat', 'thread'

    useEffect(() => {
        // Default to 'General' channel if nothing selected
        if (!selectedChannel && !isMobile) {
            setSelectedChannel({ id: 'general', name: 'General', type: 'public' });
        }
    }, [selectedChannel, isMobile]);

    const handleChannelSelect = (channel) => {
        setSelectedChannel(channel);
        setActiveThread(null);
        if (isMobile) setMobileView('chat');
    };

    const handleThreadSelect = (message) => {
        setActiveThread(message);
        if (isMobile) setMobileView('thread');
    };

    const handleBack = () => {
        if (mobileView === 'thread') {
            setMobileView('chat');
            setActiveThread(null);
        } else {
            setMobileView('list');
            setSelectedChannel(null);
        }
    };

    return (
        <Box sx={{ height: 'calc(100vh - 100px)', display: 'flex', gap: 2 }}>
            {/* Channel List - Hidden on mobile if viewing chat/thread */}
            {(!isMobile || mobileView === 'list') && (
                <Paper sx={{ width: isMobile ? '100%' : 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <ChannelList
                        selectedChannelId={selectedChannel?.id}
                        onSelectChannel={handleChannelSelect}
                    />
                </Paper>
            )}

            {/* Main Chat Area */}
            {(!isMobile || mobileView === 'chat') && selectedChannel && (
                <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <MessageList
                        channel={selectedChannel}
                        onOpenThread={handleThreadSelect}
                        onBack={isMobile ? handleBack : undefined}
                    />
                </Paper>
            )}

            {/* Thread View - Right Sidebar */}
            {(!isMobile || mobileView === 'thread') && activeThread && (
                <Paper sx={{ width: isMobile ? '100%' : 350, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid #eee' }}>
                    <ThreadView
                        parentMessage={activeThread}
                        channelId={selectedChannel?.id}
                        onClose={() => setActiveThread(null)}
                        onBack={isMobile ? handleBack : undefined}
                    />
                </Paper>
            )}
        </Box>
    );
};

export default Chat;
