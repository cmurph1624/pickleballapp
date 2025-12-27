import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '../firebase';

const TransactionHistoryModal = ({ open, onClose, userId, userEmail }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (open && userId) {
                setLoading(true);
                setTransactions([]);
                try {
                    // 1. Fetch Bets
                    const betsQuery = query(
                        collection(db, 'bets'),
                        where('userId', '==', userId)
                    );
                    const betsSnap = await getDocs(betsQuery);
                    let bets = betsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                    // Sort in memory
                    bets.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

                    if (bets.length === 0) {
                        setLoading(false);
                        return;
                    }

                    // 2. Fetch Related Weeks
                    const weekIds = [...new Set(bets.map(b => b.weekId))];
                    const weeksData = {};

                    const playersSnap = await getDocs(collection(db, 'players'));
                    const playersMap = {};
                    playersSnap.forEach(doc => {
                        playersMap[doc.id] = `${doc.data().firstName} ${doc.data().lastName}`;
                    });

                    // Fetch Weeks (using Promise.all for simplicity/performance in this context)
                    const weekDocs = await Promise.all(weekIds.map(id => getDocs(query(collection(db, 'weeks'), where(documentId(), '==', id)))));

                    weekDocs.forEach(snap => {
                        if (!snap.empty) {
                            const doc = snap.docs[0];
                            weeksData[doc.id] = doc.data();
                        }
                    });

                    // 3. Assemble Data
                    const history = bets.map(bet => {
                        const week = weeksData[bet.weekId];
                        const match = week?.matches?.find(m => m.id === bet.matchId);

                        let matchDesc = "Unknown Match";
                        if (match) {
                            const t1 = `${playersMap[match.team1[0]] || '?'} & ${playersMap[match.team1[1]] || '?'}`;
                            const t2 = `${playersMap[match.team2[0]] || '?'} & ${playersMap[match.team2[1]] || '?'}`;
                            matchDesc = `${t1} vs ${t2}`;
                        }

                        // Determine P&L display
                        let pnl = 0;
                        let pnlColor = 'text-gray-500';

                        if (bet.status === 'WON') {
                            pnl = bet.amount; // Profit is equal to amount (1:1)
                            pnlColor = 'text-green-500';
                        } else if (bet.status === 'LOST') {
                            pnl = -bet.amount;
                            pnlColor = 'text-red-500';
                        } else if (bet.status === 'PUSH') {
                            pnl = 0;
                            pnlColor = 'text-yellow-500';
                        }

                        return {
                            ...bet,
                            leagueName: week?.name || 'Unknown Week',
                            matchDesc,
                            pnl,
                            pnlColor
                        };
                    });

                    setTransactions(history);

                } catch (error) {
                    console.error("Error fetching history:", error);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchHistory();
    }, [open, userId]);

    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-surface-light dark:bg-surface-dark w-full max-w-2xl rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Transaction History
                        <span className="block text-sm font-normal text-gray-500 dark:text-gray-400 mt-1">{userEmail}</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading history...</div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">No betting history found.</div>
                    ) : (
                        <div className="space-y-4">
                            {transactions.map((tx) => (
                                <div key={tx.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-bold text-gray-900 dark:text-white">
                                            {tx.leagueName}
                                        </div>
                                        <div className={`font-bold ${tx.status === 'OPEN' ? 'text-gray-500' : tx.pnlColor}`}>
                                            {tx.status === 'OPEN' ? 'PENDING' :
                                                tx.pnl > 0 ? `+$${tx.pnl}` :
                                                    tx.pnl < 0 ? `-$${Math.abs(tx.pnl)}` : `$0`}
                                        </div>
                                    </div>

                                    <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                                        {tx.matchDesc}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                        <div className="text-gray-500 dark:text-gray-400">
                                            <span className="font-medium">Pick:</span> Team {tx.teamPicked === 1 ? '1' : '2'}
                                            {tx.spreadAtTimeOfBet !== 0 && ` (${tx.teamPicked === tx.favoriteTeamAtTimeOfBet ? '-' : '+'}${tx.spreadAtTimeOfBet})`}
                                            <span className="mx-2">•</span>
                                            <span className="font-medium">Wager:</span> ${tx.amount}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400">
                                                {new Date(tx.createdAt.seconds * 1000).toLocaleDateString()}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${tx.status === 'WON' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                                    tx.status === 'LOST' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                                                        tx.status === 'OPEN' ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300' :
                                                            'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                                }`}>
                                                {tx.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransactionHistoryModal;
