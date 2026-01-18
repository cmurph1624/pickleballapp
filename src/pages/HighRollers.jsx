import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import TransactionHistoryModal from '../components/TransactionHistoryModal';

const HighRollers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);

    useEffect(() => {
        const fetchHighRollers = async () => {
            try {
                // 1. Fetch Users
                const q = query(collection(db, 'users'), orderBy('walletBalance', 'desc'), limit(50));
                const snapshot = await getDocs(q);
                const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // 2. Fetch Players to resolve names
                const playersRef = collection(db, 'players');
                const playersSnap = await getDocs(playersRef);
                const playersMap = {}; // Map linkedUserId -> Player Data

                playersSnap.forEach(doc => {
                    const data = doc.data();
                    if (data.linkedUserId) {
                        playersMap[data.linkedUserId] = data;
                    }
                });

                // 3. Merge Data
                const mergedData = usersData.map(user => {
                    const player = playersMap[user.id]; // user.id is the uid
                    return {
                        ...user,
                        displayName: player ? `${player.firstName} ${player.lastName}` : user.email
                    };
                });

                setUsers(mergedData);
            } catch (error) {
                console.error("Error fetching high rollers:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHighRollers();
    }, []);

    const handleUserClick = (user) => {
        setSelectedUser(user);
        setHistoryModalOpen(true);
    };

    const handleResetWorld = async () => {
        if (!confirm("⚠️ WARNING ⚠️\n\nAre you sure you want to delete ALL bets and reset EVERYONE'S wallet to $500?\n\nThis action cannot be undone.")) {
            return;
        }

        const confirm2 = prompt("Type 'RESET' to confirm this destructive action:");
        if (confirm2 !== 'RESET') return;

        setLoading(true);
        try {
            const functions = getFunctions();
            const resetWorld = httpsCallable(functions, 'reset_world');
            const result = await resetWorld();

            alert(`Success!\nDeleted Bets: ${result.data.deletedBets}\nReset Users: ${result.data.resetUsers}`);
            window.location.reload(); // Refresh to show new 500 balances
        } catch (error) {
            console.error("Error resetting world:", error);
            alert("Error: " + error.message);
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center items-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="w-full">
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-4xl text-yellow-500">emoji_events</span>
                        High Rollers
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2">
                        The wealthiest players in the league. Click on a player to view their history.
                    </p>
                </div>
                <button
                    onClick={handleResetWorld}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined">restart_alt</span>
                    Reset Global Wallets
                </button>
            </div>

            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {users.map((user, index) => {
                        // Styling for top 3
                        const rankStyles = {
                            0: {
                                container: 'bg-gradient-to-r from-yellow-50 to-white dark:from-yellow-900/10 dark:to-surface-dark',
                                rank: 'bg-yellow-400 text-yellow-900 shadow-yellow-200'
                            },
                            1: {
                                container: 'bg-gradient-to-r from-gray-50 to-white dark:from-gray-800/20 dark:to-surface-dark',
                                rank: 'bg-gray-300 text-gray-800 shadow-gray-200'
                            },
                            2: {
                                container: 'bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/10 dark:to-surface-dark',
                                rank: 'bg-orange-300 text-orange-900 shadow-orange-200'
                            }
                        };

                        const style = rankStyles[index] || {
                            container: 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                            rank: 'bg-primary text-white'
                        };

                        return (
                            <div
                                key={user.id}
                                onClick={() => handleUserClick(user)}
                                className={`flex items-center justify-between p-4 sm:p-6 cursor-pointer transition-all ${style.container}`}
                            >
                                <div className="flex items-center gap-4 sm:gap-6">
                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-lg sm:text-xl shadow-sm ${style.rank}`}>
                                        {index + 1}
                                    </div>
                                    <div>
                                        <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                                            {user.displayName}
                                        </h3>
                                        {/* Optional: Show email as subtext if needed, or just rank */}
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Rank #{index + 1}</span>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-lg sm:text-2xl font-bold text-green-600 dark:text-green-400">
                                        ${user.walletBalance?.toFixed(2) || '0.00'}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {users.length === 0 && (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            No high rollers found yet.
                        </div>
                    )}
                </div>
            </div>

            <TransactionHistoryModal
                open={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                userId={selectedUser?.id}
                userEmail={selectedUser?.email}
            />
        </div>
    );
};

export default HighRollers;
