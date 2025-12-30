import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ClaimPlayer = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                // Fetch players who do NOT have a linkedUserEmail
                // Firestore doesn't support "where field is null" or "where field is missing" easily in one query combined with other filters sometimes,
                // but checking for linkedUserEmail == null or missing is usually what we want.
                // Depending on how data was saved, it might be an empty string or null.
                // A reliable way is to fetch all and filter in memory if the dataset isn't huge, 
                // OR query for `linkedUserEmail == null` AND `linkedUserEmail == ''`.

                // Let's try fetching all for now, assuming player count is reasonable (<500).
                // If it grows, we should index 'linkedUserEmail' and query specifically.

                const playersRef = collection(db, 'players');
                const snapshot = await getDocs(playersRef);

                const availablePlayers = snapshot.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(p => !p.linkedUserEmail || p.linkedUserEmail === '');

                // Sort by name
                availablePlayers.sort((a, b) => a.firstName.localeCompare(b.firstName));

                setPlayers(availablePlayers);
            } catch (error) {
                console.error("Error fetching players:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayers();
    }, []);

    const handleClaim = async () => {
        if (!selectedPlayer || !currentUser) return;
        setSubmitting(true);

        try {
            const playerRef = doc(db, 'players', selectedPlayer.id);
            await updateDoc(playerRef, {
                linkedUserId: currentUser.uid,
                linkedUserEmail: currentUser.email.toLowerCase()
            });

            // Redirect will happen automatically if HomeRedirect re-renders, 
            // but for safety we can reload or navigate to root which triggers re-check
            window.location.reload();
        } catch (error) {
            console.error("Error linking player:", error);
            alert("Failed to link player. Please try again.");
            setSubmitting(false);
        }
    };

    const filteredPlayers = players.filter(player => {
        const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase());
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-8 bg-primary text-white text-center">
                    <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <span className="material-symbols-outlined text-3xl">person_search</span>
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Claim Your Profile</h1>
                    <p className="text-white/80">
                        Select your player profile to link it to your Google account.<br />
                        <span className="text-xs opacity-75">(Signed in as {currentUser?.email})</span>
                    </p>
                </div>

                <div className="p-6">
                    <div className="mb-4 relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                        <input
                            type="text"
                            placeholder="Data Search your name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl pl-10 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                        />
                    </div>

                    <div className="h-64 overflow-y-auto space-y-2 mb-6 pr-1 custom-scrollbar">
                        {filteredPlayers.length > 0 ? (
                            filteredPlayers.map(player => (
                                <div
                                    key={player.id}
                                    onClick={() => setSelectedPlayer(player)}
                                    className={`p-3 rounded-lg cursor-pointer border transition-all flex items-center gap-3
                                        ${selectedPlayer?.id === player.id
                                            ? 'bg-primary/10 border-primary ring-1 ring-primary'
                                            : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-primary/50'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg transition-colors
                                        ${selectedPlayer?.id === player.id
                                            ? 'bg-primary text-white'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                                        }`}
                                    >
                                        {player.firstName[0]}{player.lastName[0]}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className={`font-bold ${selectedPlayer?.id === player.id ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                                            {player.firstName} {player.lastName}
                                        </h3>
                                        <div className="flex gap-2 text-xs text-gray-500">
                                            <span>Doubles: {player.duprDoubles || 'N/A'}</span>
                                            {player.gender && <span>• {player.gender}</span>}
                                        </div>
                                    </div>
                                    {selectedPlayer?.id === player.id && (
                                        <span className="material-symbols-outlined text-primary">check_circle</span>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                No matching players found.
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <button
                            onClick={handleClaim}
                            disabled={!selectedPlayer || submitting}
                            className={`w-full py-3 rounded-xl font-bold text-white transition-all
                                ${selectedPlayer && !submitting
                                    ? 'bg-primary hover:bg-primary-dark shadow-lg shadow-primary/30 transform hover:-translate-y-0.5'
                                    : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
                                }`}
                        >
                            {submitting ? 'Linking...' : selectedPlayer ? `Claim ${selectedPlayer.firstName}` : 'Select a Player'}
                        </button>

                        <div className="text-center">
                            <button
                                onClick={() => auth.signOut()}
                                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                Sign out and try a different account
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <p className="mt-8 text-center text-gray-400 text-sm max-w-sm">
                If you don't see your name, please ask an administrator to create a player profile for you first.
            </p>
        </div>
    );
};

export default ClaimPlayer;
