import React, { useState, useEffect } from 'react';
import ChannelList from '../components/chat/ChannelList';
import ChatWindow from '../components/chat/ChatWindow';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToChannels } from '../services/ChatService';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const ChatPage = () => {
    const { currentUser } = useAuth();
    const { clubId } = useParams();

    // Simple mobile detection hook-like behavior or logic
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    const [channels, setChannels] = useState([]);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [showList, setShowList] = useState(true);
    const [isInitializing, setIsInitializing] = useState(false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (!currentUser) return;
        const unsubscribe = subscribeToChannels(currentUser.uid, (fetchedChannels) => {
            setChannels(fetchedChannels);

            // Auto-select Lobby if entering from Club and no channel selected yet
            if (clubId && !selectedChannel) {
                const lobby = fetchedChannels.find(c => c.type === 'lobby' && c.contextId === clubId);
                if (lobby) setSelectedChannel(lobby);
            }
        });
        return () => unsubscribe();
    }, [currentUser, clubId]);

    const handleSelectChannel = (channel) => {
        setSelectedChannel(channel);
        if (isMobile) setShowList(false);
    };

    const handleInitialize = async () => {
        if (!clubId) return;
        if (!window.confirm("This will refresh the Club Lobby for everyone. Continue?")) return;

        setIsInitializing(true);
        try {
            const clubRef = doc(db, 'clubs', clubId);
            await updateDoc(clubRef, {
                lastChatInit: serverTimestamp()
            });
            console.log("Triggered chat initialization for club:", clubId);
        } catch (error) {
            console.error("Failed to initialize chat:", error);
            alert("Failed to initialize. detailed error in console.");
        } finally {
            setTimeout(() => setIsInitializing(false), 3000);
        }
    };

    return (
        <div className="h-[calc(100vh-6rem)] flex flex-col md:flex-row bg-sidebar-dark/30 rounded-2xl border border-white/5 overflow-hidden shadow-2xl backdrop-blur-sm">

            {/* Mobile Header to return to list */}
            {isMobile && !showList && (
                <div className="flex items-center p-3 border-b border-white/5 bg-sidebar-dark/50 text-white">
                    <button onClick={() => setShowList(true)} className="mr-3">
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <span className="font-bold truncate">{selectedChannel?.metadata?.name || 'Back to List'}</span>
                </div>
            )}

            {/* List Column */}
            <div className={`
                w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-white/5 bg-sidebar-dark
                ${(isMobile && !showList) ? 'hidden' : 'block'}
                h-full flex flex-col
            `}>
                <ChannelList
                    channels={channels}
                    selectedChannelId={selectedChannel?.id}
                    onSelectChannel={handleSelectChannel}
                />

                {channels.length === 0 && (
                    <div className="p-4 border-t border-white/5">
                        <button
                            onClick={handleInitialize}
                            disabled={isInitializing}
                            className="w-full py-2 bg-white/5 hover:bg-white/10 text-gray-300 text-xs rounded transition flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">refresh</span>
                            {isInitializing ? "Initializing..." : "Initialize Chat System"}
                        </button>
                    </div>
                )}
            </div>

            {/* Chat Column */}
            <div className={`
                flex-1 bg-background-dark relative
                ${(isMobile && showList) ? 'hidden' : 'block'}
                h-full
            `}>
                {/* Background decorative gradient/mesh can go here */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 to-blue-900/10 pointer-events-none"></div>

                <div className="relative h-full z-10">
                    <ChatWindow channel={selectedChannel} />
                </div>
            </div>
        </div>
    );
};

export default ChatPage;
