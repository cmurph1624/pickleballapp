import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, limit, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';

const UserDashboard = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // Data States
    const [allSessions, setAllSessions] = useState([]);
    const [showCompleted, setShowCompleted] = useState(false);
    const [openBets, setOpenBets] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;

            try {
                // 1. Resolve User -> Player
                const playersRef = collection(db, 'players');
                const qPlayer = query(playersRef, where('linkedUserId', '==', currentUser.uid), limit(1));
                const playerSnap = await getDocs(qPlayer);

                let linkedPlayerId = null;
                if (!playerSnap.empty) {
                    linkedPlayerId = playerSnap.docs[0].id;
                }

                // 2. Fetch All Sessions
                if (linkedPlayerId) {
                    const sessionsRef = collection(db, 'sessions');
                    const qSessions = query(sessionsRef, where('players', 'array-contains', linkedPlayerId));
                    const sessionsSnap = await getDocs(qSessions);

                    const validSessions = sessionsSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(s => {
                            if (s.archived) return false; // Exclude archived sessions
                            if (!s.scheduledDate) return false;
                            return true;
                        })
                        .sort((a, b) => {
                            const dateA = a.scheduledDate.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
                            const dateB = b.scheduledDate.toDate ? b.scheduledDate.toDate() : new Date(b.scheduledDate);
                            return dateA - dateB;
                        });

                    setAllSessions(validSessions);
                }

                // 3. Fetch Open Bets
                const betsRef = collection(db, 'bets');
                const qBets = query(
                    betsRef,
                    where('userId', '==', currentUser.uid),
                    where('status', '==', 'OPEN')
                );
                const betsSnap = await getDocs(qBets);
                const betsData = betsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setOpenBets(betsData);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            // No unsubscribe needed here as club listener moved to DashboardLayout
        };
    }, [currentUser]);

    const formatDate = (dateObj) => {
        const d = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
        return {
            month: d.toLocaleString('default', { month: 'short' }),
            day: d.getDate(),
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    };

    const handleClearBets = async () => {
        if (!window.confirm("Are you sure you want to delete ALL bets? This cannot be undone and will not refund wallets.")) return;

        try {
            const betsRef = collection(db, 'bets');
            const betsSnap = await getDocs(betsRef);

            if (betsSnap.empty) {
                alert("No bets to delete.");
                return;
            }

            const promises = betsSnap.docs.map(b => deleteDoc(doc(db, 'bets', b.id)));
            await Promise.all(promises);

            alert(`Deleted ${betsSnap.size} bets.`);
            // Refresh bets
            setOpenBets([]);
        } catch (error) {
            console.error("Error deleting bets:", error);
            alert("Error deleting bets: " + error.message);
        }
    };

    // Filter Logic
    const getVisibleSessions = () => {
        const now = new Date();

        return allSessions.filter(session => {
            if (showCompleted) return true; // Show all if toggle is on

            // Otherwise, show only upcoming
            const d = session.scheduledDate.toDate ? session.scheduledDate.toDate() : new Date(session.scheduledDate);
            return d > now;
        });
    };

    const visibleSessions = getVisibleSessions();

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-background-light dark:bg-background-dark">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <section className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
                    Welcome Back, {currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'Player'}!
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm">Here is what's happening in your league careers.</p>
            </section>

            <section className="mb-6">
                <div className="bg-primary text-white rounded-2xl p-6 shadow-lg relative overflow-hidden">
                    <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="flex items-center gap-2 mb-2 opacity-90">
                        <span className="material-symbols-outlined">account_balance_wallet</span>
                        <span className="text-sm font-medium uppercase tracking-wider">Wallet Balance</span>
                    </div>
                    <div className="flex items-end gap-2 mb-4">
                        <span className="text-4xl font-bold tracking-tight">
                            ${currentUser.walletBalance?.toFixed(2) || '0.00'}
                        </span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-xs text-white/80 bg-black/20 px-2 py-1 rounded-md">Available for betting</span>
                        <button className="bg-white text-primary px-4 py-2 rounded-lg text-sm font-semibold shadow-sm active:scale-95 transition-transform">
                            Deposit
                        </button>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-8">
                <section className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-white">
                            <span className="material-symbols-outlined text-primary">sports_tennis</span>
                            <h3 className="text-lg font-bold">
                                {showCompleted ? "All Sessions" : "Upcoming Schedule"}
                            </h3>
                        </div>
                        {/* Toggle Switch */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                {showCompleted ? "Showing All" : "Upcoming Only"}
                            </span>
                            <button
                                onClick={() => setShowCompleted(!showCompleted)}
                                className={`
                                    relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                                    ${showCompleted ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}
                                `}
                            >
                                <span
                                    className={`
                                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                        ${showCompleted ? 'translate-x-6' : 'translate-x-1'}
                                    `}
                                />
                            </button>
                        </div>
                    </div>

                    {visibleSessions.length > 0 ? (
                        visibleSessions.map(session => {
                            const { month, day, time } = formatDate(session.scheduledDate);
                            const isPast = (session.scheduledDate.toDate ? session.scheduledDate.toDate() : new Date(session.scheduledDate)) < new Date();

                            return (
                                <div
                                    key={session.id}
                                    className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-3 last:mb-0 cursor-pointer hover:border-primary transition"
                                    onClick={() => navigate(`/clubs/${session.clubId || 'unknown'}/leagues/${session.leagueId}/sessions/${session.id}`)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            {isPast ? (
                                                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                                                    Completed
                                                </span>
                                            ) : (
                                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                                                    Next Match
                                                </span>
                                            )}

                                            <h4 className="text-base font-semibold mt-2 text-gray-900 dark:text-white capitalize">
                                                {session.name}
                                            </h4>
                                        </div>
                                        <div className={`text-center border rounded-lg p-2 min-w-[60px] ${isPast ? 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-75' : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700'}`}>
                                            <span className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">{month}</span>
                                            <span className="block text-lg font-bold text-gray-800 dark:text-white">{day}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-2">
                                        <span className="material-symbols-outlined text-lg">schedule</span>
                                        <span>{time}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                        <span className="material-symbols-outlined text-lg">location_on</span>
                                        <span>Court TBD</span>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 text-center text-gray-500 text-sm">
                            {showCompleted ? "No sessions found." : "No upcoming matches scheduled."}
                        </div>
                    )}
                </section>

                <section className="mb-6">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2 text-gray-800 dark:text-white">
                            <span className="material-symbols-outlined text-orange-500">emoji_events</span>
                            <h3 className="text-lg font-bold">Active Bets ({openBets.length})</h3>
                        </div>
                        <button
                            onClick={handleClearBets}
                            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded transition"
                        >
                            Delete All Bets
                        </button>
                    </div>
                    <div className="space-y-3">
                        {openBets.length > 0 ? (
                            openBets.map(bet => (
                                <div key={bet.id} className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-green-500/10 to-transparent rounded-bl-full"></div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                                Spread: <span className="font-bold text-gray-800 dark:text-gray-200">{bet.spreadAtTimeOfBet}</span>
                                            </p>
                                            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                                                ${bet.amount} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">on</span> Team {bet.teamPicked}
                                            </h4>
                                        </div>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800">
                                            OPEN
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end mt-2">
                                        <span className="text-xs text-gray-400 dark:text-gray-500">Match ID: #{bet.id.slice(-4)}</span>
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Potential Payout</p>
                                            <p className="text-sm font-bold text-primary">${(bet.amount * 2).toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 text-center text-gray-500 text-sm">
                                No active bets found.
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </DashboardLayout>
    );
};

export default UserDashboard;
