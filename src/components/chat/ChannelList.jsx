import React, { useState } from 'react';
import { useClub } from '../../contexts/ClubContext';
import { useAuth } from '../../contexts/AuthContext';
import { createDMChannel } from '../../services/ChatService';

const ChannelList = ({ channels, selectedChannelId, onSelectChannel }) => {
    const { activeClub } = useClub(); // Context might be null if not in a club route, but this component is used in ChatPage under ClubProvider
    const { currentUser } = useAuth();
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [players, setPlayers] = useState([]);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    // Group channels
    const lobbies = channels.filter(c => c.type === 'lobby');
    const huddles = channels.filter(c => c.type === 'huddle');
    const dms = channels.filter(c => c.type === 'dm');

    const handleCreateDM = async (otherUser) => {
        try {
            const channelId = await createDMChannel(currentUser.uid, otherUser.linkedUserId, `${otherUser.firstName} ${otherUser.lastName}`);
            setIsPickerOpen(false);

            // Explicitly select the new channel immediately
            // We construct a temporary channel object so the UI updates instantly
            // even if the listener hasn't pushed the new doc yet.
            const newChannel = {
                id: channelId,
                type: 'dm',
                metadata: {
                    name: `${otherUser.firstName} ${otherUser.lastName}`,
                    isDM: true
                },
                allowedUserIds: [currentUser.uid, otherUser.linkedUserId]
            };

            onSelectChannel(newChannel);

        } catch (error) {
            console.error("Failed to create DM", error);
            alert("Failed to start conversation.");
        }
    };

    const openPicker = async () => {
        setIsPickerOpen(true);
        setLoadingPlayers(true);
        try {
            const { getDocs, collection } = await import('firebase/firestore');
            const { db } = await import('../../firebase');

            const snap = await getDocs(collection(db, 'players'));
            let allPlayers = snap.docs.map(d => d.data());

            // Filter out self and unlinked players
            allPlayers = allPlayers.filter(p => p.linkedUserId && p.linkedUserId !== currentUser.uid);
            setPlayers(allPlayers);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingPlayers(false);
        }
    };

    const filteredPlayers = players.filter(p =>
        (p.firstName + ' ' + p.lastName).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const [dmNames, setDmNames] = useState({});

    // Fetch names for DMs
    React.useEffect(() => {
        const fetchDMNames = async () => {
            // 1. Identify UIDs we need to fetch (the 'other' person in each DM)
            const uidsToFetch = new Set();
            dms.forEach(dm => {
                const otherId = dm.allowedUserIds?.find(uid => uid !== currentUser.uid);
                if (otherId && !dmNames[otherId]) {
                    uidsToFetch.add(otherId);
                }
            });

            if (uidsToFetch.size === 0) return;

            try {
                const { getDocs, query, where, collection, documentId } = await import('firebase/firestore');
                const { db } = await import('../../firebase');

                // We can fetch by 'linkedUserId' 
                // Note: 'players' collection has 'linkedUserId' field. 
                // So we need: where('linkedUserId', 'in', [...])
                // Firestore 'in' limit is 10. If we have >10 DMs with unknown names, we might need chunking.
                // For MVP, lets just take the first 10 unseen ones.

                const uidList = Array.from(uidsToFetch).slice(0, 10);

                const q = query(collection(db, 'players'), where('linkedUserId', 'in', uidList));
                const snapshot = await getDocs(q);

                const newNames = { ...dmNames };
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.linkedUserId) {
                        newNames[data.linkedUserId] = `${data.firstName} ${data.lastName}`;
                    }
                });

                // Also handling case were no player profile exists? Use "Unknown User"?
                // Or maybe they are just admins with no player profile?
                // For now, update state.
                setDmNames(newNames);

            } catch (error) {
                console.error("Error resolving DM names:", error);
            }
        };

        if (dms.length > 0 && currentUser) {
            fetchDMNames();
        }
    }, [dms, currentUser]); // Dependency on dms (when list updates)

    const renderChannelItem = (channel) => {
        let displayName = channel.metadata?.name || 'Unnamed Channel';
        if (channel.type === 'dm') {
            const otherUserId = channel.allowedUserIds?.find(uid => uid !== currentUser.uid);

            // Prefer the resolved name if available, otherwise check metadata?
            // Current metadata.name might be stale or just wrong if we didn't set it nicely.
            // Actually, for DMs created via our new UI, the metadata.name is "FirstName LastName" of the target.
            // BUT that works for the CREATOR. For the RECEIVER, that metadata.name is THEIR OWN NAME (oops).
            // So we MUST rely on dynamic resolution or better metadata.

            if (otherUserId && dmNames[otherUserId]) {
                displayName = dmNames[otherUserId];
            } else if (channel.metadata?.name && channel.metadata.name !== 'Private Conversation') {
                // Fallback to static name if it looks like a name? 
                // Risk: Seeing your own name.
                // Better to show "Loading..." or "Private Chat" until resolved?
                // Or stick with generic if identifying fails.
                displayName = "Private Conversation";
            } else {
                displayName = "Private Conversation";
            }
        }

        return (
            <div key={channel.id} className="px-2 mb-1">
                <div
                    onClick={() => onSelectChannel(channel)}
                    className={`
                        flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-200
                        ${selectedChannelId === channel.id
                            ? 'bg-primary text-white shadow-lg shadow-primary/30'
                            : 'hover:bg-white/5 text-gray-400 hover:text-white'
                        }
                    `}
                >
                    <div className="overflow-hidden">
                        <p className={`font-medium truncate ${selectedChannelId === channel.id ? 'text-white' : 'text-gray-200'}`}>
                            {displayName}
                        </p>
                        {channel.metadata?.location && (
                            <p className={`text-xs truncate ${selectedChannelId === channel.id ? 'text-blue-100' : 'text-gray-500'}`}>
                                {channel.metadata.location}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const SectionHeader = ({ title, action }) => (
        <div className="px-4 py-2 mt-2 flex justify-between items-center">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
            {action}
        </div>
    );

    return (
        <div className="h-full flex flex-col bg-sidebar-dark/50 backdrop-blur-sm border-r border-white/5 relative">
            <div className="p-4 border-b border-white/5">
                <h2 className="text-xl font-bold text-white tracking-tight">Messages</h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="py-2">
                    <SectionHeader title="Clubs (Lobbies)" />
                    {lobbies.length > 0 ? lobbies.map(renderChannelItem) : (
                        <p className="px-4 py-2 text-sm text-gray-600 italic">No active club lobbies.</p>
                    )}

                    <SectionHeader title="Session Huddles" />
                    {huddles.length > 0 ? huddles.map(renderChannelItem) : (
                        <p className="px-4 py-2 text-sm text-gray-600 italic">Join a session to see its Huddle.</p>
                    )}

                    <SectionHeader
                        title="Direct Messages"
                        action={
                            <button onClick={openPicker} className="text-gray-400 hover:text-white transition">
                                <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                        }
                    />
                    {dms.length > 0 ? dms.map(renderChannelItem) : (
                        <p className="px-4 py-2 text-sm text-gray-600 italic">No active conversations.</p>
                    )}
                </div>
            </div>

            {/* User Picker Modal */}
            {isPickerOpen && (
                <div className="absolute inset-0 z-50 bg-sidebar-dark/95 backdrop-blur flex flex-col p-4 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-white">New Message</h3>
                        <button onClick={() => setIsPickerOpen(false)} className="p-1 hover:bg-white/10 rounded-full">
                            <span className="material-symbols-outlined text-gray-400">close</span>
                        </button>
                    </div>

                    <input
                        type="text"
                        placeholder="Search players..."
                        className="w-full bg-black/20 text-white rounded-lg px-4 py-2 border border-white/10 mb-4 focus:outline-none focus:border-primary"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />

                    <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2">
                        {loadingPlayers ? (
                            <p className="text-center text-gray-500 mt-4">Loading players...</p>
                        ) : (
                            <div className="space-y-1">
                                {filteredPlayers.map(p => (
                                    <button
                                        key={p.linkedUserId}
                                        onClick={() => handleCreateDM(p)}
                                        className="w-full text-left flex items-center p-3 hover:bg-white/5 rounded-lg transition"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center text-white font-bold text-xs mr-3">
                                            {p.firstName[0]}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium">{p.firstName} {p.lastName}</p>
                                        </div>
                                    </button>
                                ))}
                                {filteredPlayers.length === 0 && (
                                    <p className="text-center text-gray-500 mt-4">No players found</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChannelList;
