import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ReviewBetsModal = ({ open, onClose, match, team1Name, team2Name }) => {
    const [loading, setLoading] = useState(false);
    const [team1Bets, setTeam1Bets] = useState([]);
    const [team2Bets, setTeam2Bets] = useState([]);
    const [totalTeam1, setTotalTeam1] = useState(0);
    const [totalTeam2, setTotalTeam2] = useState(0);

    useEffect(() => {
        const fetchBets = async () => {
            if (open && match) {
                setLoading(true);
                try {
                    const q = query(
                        collection(db, 'bets'),
                        where('matchId', '==', match.id)
                    );
                    const querySnapshot = await getDocs(q);

                    const bets = await Promise.all(querySnapshot.docs.map(async (docSnapshot) => {
                        const betData = docSnapshot.data();

                        // Get user name
                        let userName = 'Unknown User';
                        if (betData.userId) {
                            try {
                                // 1. Try to find a linked Player (Preferred)
                                const playersQ = query(collection(db, 'players'), where('linkedUserId', '==', betData.userId));
                                const playersSnap = await getDocs(playersQ);

                                if (!playersSnap.empty) {
                                    const pData = playersSnap.docs[0].data();
                                    userName = `${pData.firstName} ${pData.lastName}`;
                                } else {
                                    // 2. Fallback to Users collection
                                    const userDoc = await getDoc(doc(db, 'users', betData.userId));
                                    if (userDoc.exists()) {
                                        const userData = userDoc.data();
                                        const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                                        userName = fullName || userData.displayName || userData.email || 'Unknown User';
                                    }
                                }
                            } catch (e) {
                                console.error("Error fetching user/player for bet:", e);
                                try {
                                    const userDoc = await getDoc(doc(db, 'users', betData.userId));
                                    if (userDoc.exists()) {
                                        const userData = userDoc.data();
                                        const fullName = `${userData.firstName || ''} ${userData.lastName || ''}`.trim();
                                        userName = fullName || userData.displayName || userData.email || 'Unknown User';
                                    }
                                } catch (e2) { console.error("Double fallback failed", e2); }
                            }
                        }

                        return {
                            id: docSnapshot.id,
                            ...betData,
                            userName
                        };
                    }));

                    // Sort bets by amount desc
                    bets.sort((a, b) => b.amount - a.amount);

                    const t1Bets = bets.filter(b => b.teamPicked === 1);
                    const t2Bets = bets.filter(b => b.teamPicked === 2);

                    setTeam1Bets(t1Bets);
                    setTeam2Bets(t2Bets);
                    setTotalTeam1(t1Bets.reduce((sum, b) => sum + b.amount, 0));
                    setTotalTeam2(t2Bets.reduce((sum, b) => sum + b.amount, 0));

                } catch (err) {
                    console.error("Error fetching bets:", err);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchBets();
    }, [open, match]);

    if (!match || !open) return null;

    const renderBetList = (bets, total) => (
        <div>
            <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
                Total Wagered: <span className="text-green-600 dark:text-green-400 font-bold">${total}</span>
            </div>
            {bets.length === 0 ? (
                <div className="text-sm text-gray-400 italic">
                    No bets placed.
                </div>
            ) : (
                <div className="space-y-2">
                    {bets.map((bet) => (
                        <div key={bet.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {bet.userName}
                            </span>
                            <span className="text-sm font-bold text-primary">
                                ${bet.amount}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-surface-light dark:bg-surface-dark w-full max-w-2xl rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-surface-light dark:bg-surface-dark">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Review Bets
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center items-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Team 1 */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                                    {team1Name}
                                </h3>
                                {renderBetList(team1Bets, totalTeam1)}
                            </div>

                            {/* Team 2 */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                                    {team2Name}
                                </h3>
                                {renderBetList(team2Bets, totalTeam2)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-800/50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReviewBetsModal;
