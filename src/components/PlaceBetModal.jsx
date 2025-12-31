import React, { useState } from 'react';
import { doc, runTransaction, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

const PlaceBetModal = ({ open, onClose, match, weekId, team1Name, team2Name, userWallet }) => {
    const [teamPicked, setTeamPicked] = useState('1');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const [existingBet, setExistingBet] = useState(null);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        const fetchExistingBet = async () => {
            if (open && match && auth.currentUser) {
                setLoading(true);
                setAmount('');
                setTeamPicked('1');
                setError('');
                setExistingBet(null);

                try {
                    const q = query(
                        collection(db, 'bets'),
                        where('userId', '==', auth.currentUser.uid),
                        where('matchId', '==', match.id)
                    );
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        const betData = querySnapshot.docs[0].data();
                        setExistingBet(betData);
                    }
                } catch (err) {
                    console.error("Error fetching existing bet:", err);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchExistingBet();
    }, [open, match]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const betAmount = parseInt(amount);

        if (isNaN(betAmount) || betAmount <= 0) {
            setError("Please enter a valid amount.");
            return;
        }

        if (betAmount > userWallet) {
            setError("Insufficient funds.");
            return;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', auth.currentUser.uid);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists()) {
                    throw "User not found";
                }

                const currentBalance = userDoc.data().walletBalance || 0;
                if (betAmount > currentBalance) {
                    throw "Insufficient funds";
                }

                const newBalance = currentBalance - betAmount;
                transaction.update(userRef, { walletBalance: newBalance });

                const newBetRef = doc(collection(db, 'bets'));
                transaction.set(newBetRef, {
                    userId: auth.currentUser.uid,
                    weekId: weekId,
                    matchId: match.id || `match_${Date.now()}`,
                    teamPicked: parseInt(teamPicked),
                    amount: betAmount,
                    spreadAtTimeOfBet: match.spread,
                    favoriteTeamAtTimeOfBet: match.favoriteTeam,
                    status: 'OPEN',
                    createdAt: new Date()
                });
            });

            onClose();
        } catch (err) {
            console.error("Error placing bet:", err);
            setError(typeof err === 'string' ? err : "Failed to place bet.");
        }
    };

    if (!match || !open) return null;

    const spreadText = (team) => {
        if (match.spread === 0) return "Pick 'em";
        if (match.favoriteTeam === team) return `-${match.spread}`;
        return `+${match.spread}`;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-surface-light dark:bg-surface-dark w-full max-w-sm rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-surface-light dark:bg-surface-dark">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Place Bet
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : existingBet ? (
                        <div className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 p-4 rounded-xl border border-blue-200 dark:border-blue-800 text-sm">
                                You have already placed a bet on this match.
                            </div>

                            <div className="bg-surface-light dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                <div className="mb-4">
                                    <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-bold mb-1">Your Pick</h4>
                                    <p className="text-lg font-bold text-gray-900 dark:text-white">
                                        {existingBet.teamPicked === 1 ? team1Name : team2Name}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Spread: {existingBet.spreadAtTimeOfBet === 0 ? "Pick 'em" : existingBet.spreadAtTimeOfBet}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-bold mb-1">Wager</h4>
                                    <p className="text-lg font-bold text-primary">
                                        ${existingBet.amount}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Matchup Info */}
                            <div className="text-center pb-4 border-b border-gray-100 dark:border-gray-800">
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Matchup</p>
                                <p className="font-bold text-gray-900 dark:text-white">{team1Name}</p>
                                <p className="text-xs text-gray-400 my-1">vs</p>
                                <p className="font-bold text-gray-900 dark:text-white">{team2Name}</p>
                            </div>

                            {/* Pick Winner */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    Select Winner (with Spread)
                                </label>
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={() => setTeamPicked('1')}
                                        className={`w-full p-3 rounded-xl border-2 transition-all flex justify-between items-center ${teamPicked === '1'
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                    >
                                        <span className={`font-bold ${teamPicked === '1' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{team1Name}</span>
                                        <span className="text-xs font-bold bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                            {spreadText(1)}
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTeamPicked('2')}
                                        className={`w-full p-3 rounded-xl border-2 transition-all flex justify-between items-center ${teamPicked === '2'
                                                ? 'border-primary bg-primary/5 text-primary'
                                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                            }`}
                                    >
                                        <span className={`font-bold ${teamPicked === '2' ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{team2Name}</span>
                                        <span className="text-xs font-bold bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                            {spreadText(2)}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Wager Amount */}
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Wager Amount
                                    </label>
                                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                                        Balance: <span className="text-green-600 dark:text-green-400 font-bold">${userWallet}</span>
                                    </span>
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                                    <input
                                        type="number"
                                        min="1"
                                        max={userWallet}
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-8 pr-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-surface-light dark:bg-gray-900/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all font-bold"
                                        placeholder="Enter amount..."
                                        required
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800">
                                    {error}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-xl shadow-lg shadow-primary/30 transition-all transform active:scale-95"
                                >
                                    Place Bet
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                {/* Close button for ExistingBet view */}
                {existingBet && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-end bg-gray-50 dark:bg-gray-800/50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlaceBetModal;
