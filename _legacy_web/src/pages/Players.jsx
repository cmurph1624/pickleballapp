import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import PlayerModal from '../components/PlayerModal';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { useNavigate } from 'react-router-dom';

const Players = () => {
    const [players, setPlayers] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { isAdmin } = useClub();

    useEffect(() => {
        const q = query(collection(db, 'players'), orderBy('firstName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const playersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPlayers(playersData);
        });

        return () => unsubscribe();
    }, []);

    const handleAdd = () => {
        setSelectedPlayer(null);
        setModalOpen(true);
    };

    const handleEdit = (player) => {
        setSelectedPlayer(player);
        setModalOpen(true);
    };

    const handleDelete = async (e, player) => {
        e.stopPropagation();
        if (window.confirm(`Delete ${player.firstName}?`)) {
            try {
                await deleteDoc(doc(db, 'players', player.id));
            } catch (error) {
                console.error("Error deleting player:", error);
                alert("Error deleting player: " + error.message);
            }
        }
    };

    const handleResetRatings = async () => {
        if (window.confirm("Are you sure you want to reset ALL player ratings based on their DUPR? This cannot be undone.")) {
            try {
                const querySnapshot = await getDocs(collection(db, "players"));
                const updates = [];
                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const dupr = data.duprDoubles || 3.5;
                    const newRating = dupr * 10;
                    updates.push(updateDoc(doc(db, "players", docSnap.id), { hiddenRating: newRating }));
                });
                await Promise.all(updates);
                alert(`Successfully reset ratings for ${updates.length} players.`);
            } catch (error) {
                console.error("Error resetting ratings:", error);
                alert("Error resetting ratings: " + error.message);
            }
        }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedPlayer(null);
    };

    const filteredPlayers = players.filter(player => {
        const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    return (
        <div className="w-full">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Players</h1>

                {isAdmin && (
                    <button
                        onClick={() => navigate('../invite')}
                        className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm flex items-center gap-2 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Invite New Player
                    </button>
                )}
            </div>

            <div className="relative mb-6">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                <input
                    type="text"
                    placeholder="Search players..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24">
                {filteredPlayers.map((player) => (
                    <div
                        key={player.id}
                        className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:border-primary transition group relative"
                    >
                        <div className="flex items-start gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg flex-shrink-0">
                                {player.firstName[0]}{player.lastName[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                                    {player.firstName} {player.lastName}
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{player.gender}</p>
                            </div>
                        </div>

                        <div className="flex gap-2 flex-wrap mt-3">
                            <div className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 font-medium">
                                DUPR (D): {player.duprDoubles || 'N/A'}
                            </div>
                            <div className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300 font-medium">
                                DUPR (S): {player.duprSingles || 'N/A'}
                            </div>
                        </div>

                        {isAdmin && (
                            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(player)}
                                    className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    title="Edit"
                                >
                                    <span className="material-symbols-outlined text-lg">edit</span>
                                </button>
                                <button
                                    onClick={(e) => handleDelete(e, player)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                    title="Delete"
                                >
                                    <span className="material-symbols-outlined text-lg">delete</span>
                                </button>
                            </div>
                        )}
                    </div>
                ))}

                {filteredPlayers.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500 dark:text-gray-400">
                        No players found matching "{searchQuery}"
                    </div>
                )}
            </div>

            {isAdmin && (
                <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-30">
                    <button
                        onClick={handleResetRatings}
                        className="w-12 h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
                        title="Reset All Ratings"
                    >
                        <span className="material-symbols-outlined">restart_alt</span>
                    </button>
                    <button
                        onClick={handleAdd}
                        className="w-12 h-12 bg-primary hover:bg-primary-dark text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
                        title="Add Player"
                    >
                        <span className="material-symbols-outlined">add</span>
                    </button>
                </div>
            )}

            <PlayerModal
                open={modalOpen}
                onClose={handleCloseModal}
                player={selectedPlayer}
            />
        </div>
    );
};

export default Players;
