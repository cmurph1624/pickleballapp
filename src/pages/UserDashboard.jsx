import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, limit, deleteDoc, doc, getDoc, updateDoc, arrayUnion, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { joinSession, leaveSession } from '../services/SessionService';

const UserDashboard = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // Data States
    const [mySessions, setMySessions] = useState([]);
    const [availableSessions, setAvailableSessions] = useState([]);
    const [showCompleted, setShowCompleted] = useState(false);
    const [openBets, setOpenBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [linkedPlayerId, setLinkedPlayerId] = useState(null);
    const [activeTab, setActiveTab] = useState('matches');

    useEffect(() => {
        let unsubscribeSessions = null;

        const fetchData = async () => {
            if (!currentUser) return;

            try {
                // 1. Resolve User -> Player
                const playersRef = collection(db, 'players');
                const qPlayer = query(playersRef, where('linkedUserId', '==', currentUser.uid), limit(1));
                const playerSnap = await getDocs(qPlayer);

                let playerId = null;
                if (!playerSnap.empty) {
                    playerId = playerSnap.docs[0].id;
                    setLinkedPlayerId(playerId);
                }

                // 2. Fetch User's Club Memberships
                const clubsRef = collection(db, 'clubs');
                const qClubs = query(clubsRef, where('members', 'array-contains', currentUser.uid));
                const clubsSnap = await getDocs(qClubs);
                const userClubIds = clubsSnap.docs.map(d => d.id);
                console.log("Debug: User is member of clubs:", userClubIds);

                // 3. Fetch All Sessions (Real-time listener)
                const sessionsRef = collection(db, 'sessions');
                const qSessions = query(sessionsRef);

                unsubscribeSessions = onSnapshot(qSessions, (sessionsSnap) => {
                    console.log(`Debug: Received ${sessionsSnap.size} session updates from Firestore.`);

                    const now = new Date();
                    const allFetchedSessions = sessionsSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(s => {
                            if (s.archived) return false;
                            if (!s.scheduledDate) return false;
                            return true;
                        })
                        .sort((a, b) => {
                            const dateA = a.scheduledDate.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
                            const dateB = b.scheduledDate.toDate ? b.scheduledDate.toDate() : new Date(b.scheduledDate);
                            return dateA - dateB;
                        });

                    // Filter: My Sessions vs Available Sessions
                    const mySess = [];
                    const availSess = [];

                    allFetchedSessions.forEach(session => {
                        const isPlayerIn = playerId && (
                            (session.players && session.players.includes(playerId)) ||
                            (session.waitlist && session.waitlist.includes(playerId))
                        );

                        // Helper to get date object
                        const d = session.scheduledDate.toDate ? session.scheduledDate.toDate() : new Date(session.scheduledDate);
                        const isFuture = d > now;

                        if (isPlayerIn) {
                            mySess.push(session);
                        } else if (isFuture) {
                            // Only future sessions are "Available" to join
                            // CHECK: Is user a member of the session's club?
                            // Legacy sessions might not have clubId, so we might want to default to true for them OR false.
                            // Assuming strict mode: must match clubId. 
                            // If session.clubId is missing, it won't be in userClubIds, so it hides.
                            if (session.clubId && userClubIds.includes(session.clubId)) {
                                availSess.push(session);
                            } else if (!session.clubId) {
                                // Optional: Handle legacy sessions without clubId. 
                                // For now, let's show them? Or hide them? 
                                // User requested "validating they are part of the club". 
                                // If no clubId, we can't validate. Let's hide them to be safe/strict as requested.
                                // If they are critical, they should be backfilled.
                                // console.warn("Session missing clubId, hiding from available:", session.id);
                            }
                        }
                    });

                    console.log(`Debug: Found ${mySess.length} My Sessions and ${availSess.length} Available Sessions.`);
                    setMySessions(mySess);
                    setAvailableSessions(availSess);
                    setLoading(false); // Stop loading once we have data
                }, (error) => {
                    console.error("Error listening to sessions:", error);
                    setLoading(false);
                });

                // 3. Fetch Open Bets & Resolve Details
                const betsRef = collection(db, 'bets');
                const qBets = query(
                    betsRef,
                    where('userId', '==', currentUser.uid),
                    where('status', '==', 'OPEN')
                );
                const betsSnap = await getDocs(qBets);
                let betsData = betsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Resolve names for bets
                if (betsData.length > 0) {
                    const playersRef = collection(db, 'players');
                    const playersSnap = await getDocs(playersRef);
                    const playersMap = {};
                    playersSnap.forEach(doc => {
                        playersMap[doc.id] = doc.data();
                    });

                    const uniqueSessionIds = [...new Set(betsData.map(b => b.weekId).filter(id => id))];

                    if (uniqueSessionIds.length > 0) {
                        try {
                            const sessionDocsPromises = uniqueSessionIds.map(sid => getDoc(doc(db, 'sessions', sid)));
                            const sessionDocsSnaps = await Promise.all(sessionDocsPromises);

                            const sessionsMap = {};
                            sessionDocsSnaps.forEach(snap => {
                                if (snap.exists()) sessionsMap[snap.id] = snap.data();
                            });

                            betsData = betsData.map(bet => {
                                if (!bet.weekId || !sessionsMap[bet.weekId]) return bet;

                                const session = sessionsMap[bet.weekId];
                                let teamNameDisplay = `Team ${bet.teamPicked}`;

                                if (session && session.matches) {
                                    const match = session.matches.find(m => m.id === bet.matchId);
                                    if (match) {
                                        const teamKey = bet.teamPicked === 1 ? 'team1' : 'team2';
                                        const teamPlayerIds = match[teamKey] || [];

                                        const names = teamPlayerIds.map(pid => {
                                            const p = playersMap[pid];
                                            return p ? `${p.firstName} ${p.lastName?.charAt(0) || ''}` : 'Unknown';
                                        });

                                        if (names.length > 0) {
                                            teamNameDisplay = names.join(" & ");
                                        }
                                    }
                                }
                                return { ...bet, teamNameDisplay };
                            });
                        } catch (err) {
                            console.error("Error fetching sessions for bets:", err);
                        }
                    }
                }

                setOpenBets(betsData);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
                setLoading(false);
            }
        };

        fetchData();

        return () => {
            if (unsubscribeSessions) {
                unsubscribeSessions();
            }
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
        if (!window.confirm("Are you sure you want to delete ALL bets? This calls for a fresh start! This will delete all bets AND reset every user's wallet back to $500.")) return;

        try {
            // 1. Delete All Bets
            const betsRef = collection(db, 'bets');
            const betsSnap = await getDocs(betsRef);

            const deletePromises = betsSnap.docs.map(b => deleteDoc(doc(db, 'bets', b.id)));
            await Promise.all(deletePromises);

            // 2. Reset All Users' Wallets to 500
            const usersRef = collection(db, 'users');
            const usersSnap = await getDocs(usersRef);

            const resetPromises = usersSnap.docs.map(userDoc =>
                updateDoc(doc(db, 'users', userDoc.id), { walletBalance: 500 })
            );
            await Promise.all(resetPromises);

            alert(`Deleted ${betsSnap.size} bets and reset ${usersSnap.size} user wallets to $500.`);
            setOpenBets([]);
        } catch (error) {
            console.error("Error clearing data:", error);
            alert("Error clearing data: " + error.message);
        }
    };

    const handleJoinSession = async (e, sessionId) => {
        e.stopPropagation(); // Prevent card click navigation

        if (!linkedPlayerId) {
            alert("You must have a linked player profile to join sessions.");
            return;
        }

        const sessionToJoin = availableSessions.find(s => s.id === sessionId);
        const isWaitlist = sessionToJoin && sessionToJoin.playerLimit > 0 && (sessionToJoin.players || []).length >= sessionToJoin.playerLimit;

        const actionText = isWaitlist ? "join the WAITLIST for" : "join";

        if (!window.confirm(`Are you sure you want to ${actionText} this session?`)) return;

        try {
            // Use Service
            const status = await joinSession(sessionId, linkedPlayerId);

            // Optimistic Update / Refresh
            // For simplicity, we'll remove it from available sessions or update the list.
            // But since we need to show "My Sessions" update, manual state update is tricky with waitlist.
            // Ideally we re-fetch or use onSnapshot.
            // For now, let's just do a simple update or reload.

            // To be safe and see correct status, let's remove from available and add to mySessions (if joined)
            // If waitlisted, it might also show in mySessions depending on logic?
            // "My Sessions" filter checks: isPlayerIn = playerId && session.players && session.players.includes(playerId);
            // It DOES NOT check waitlist. 
            // So if waitlisted, it won't show in "My Sessions" with current logic.
            // We should probably update "My Sessions" filter to include waitlisted sessions.

            // Actually, let's just reload the page/data for correctness as we are not using listeners here.
            // Or better, trigger a re-fetch.
            // Re-fetch logic is inside useEffect, hard to trigger from here without refactor.
            // We'll update state manually for "Joined", but for "Waitlisted" maybe we show an alert.

            if (status === 'JOINED') {
                setAvailableSessions(prev => prev.filter(s => s.id !== sessionId));
                // Add to mySessions logic (omitted for brevity, assume reload or simple add)
                alert("Successfully joined the session!");
                window.location.reload(); // Simple refresh to ensure all states (including mySessions) are correct
            } else if (status === 'WAITLISTED') {
                alert("You have been added to the waitlist.");
                window.location.reload();
            }

        } catch (error) {
            console.error("Error joining session:", error);
            alert("Failed to join session: " + error.message);
        }
    };

    const handleLeaveSession = async (e, sessionId) => {
        e.stopPropagation();
        if (!linkedPlayerId) return;

        if (!window.confirm("Are you sure you want to LEAVE this session?")) return;

        try {
            await leaveSession(sessionId, linkedPlayerId);
            // Optimistic update not needed heavily due to onSnapshot, but we can alert
            alert("You have left the session.");
        } catch (error) {
            console.error("Error leaving session:", error);
            alert("Failed to leave session: " + error.message);
        }
    };

    // Filter Logic for "My Sessions" (Upcoming vs All)
    const getVisibleMySessions = () => {
        const now = new Date();

        return mySessions.filter(session => {
            if (showCompleted) return true; // Show all if toggle is on

            // Otherwise, show only upcoming
            const d = session.scheduledDate.toDate ? session.scheduledDate.toDate() : new Date(session.scheduledDate);
            return d > now;
        });
    };

    const visibleMySessions = getVisibleMySessions();

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-background-light dark:bg-background-dark">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            {/* TAB NAVIGATION */}
            <div className="flex space-x-4 mb-6 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('matches')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === 'matches'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                >
                    Matches
                </button>
                <button
                    onClick={() => setActiveTab('betting')}
                    className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === 'betting'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                >
                    Betting
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                {/* MATCHES TAB */}
                {activeTab === 'matches' && (
                    <div className="space-y-6">
                        {/* AVAILABLE SESSIONS */}
                        {availableSessions.length > 0 && (
                            <section>
                                <div className="flex justify-between items-center mb-3">
                                    <div className="flex items-center gap-2 text-gray-800 dark:text-white">
                                        <span className="material-symbols-outlined text-green-500">add_circle</span>
                                        <h3 className="text-lg font-bold">New Sessions Available</h3>
                                    </div>
                                </div>
                                {availableSessions.map(session => {
                                    const { month, day, time } = formatDate(session.scheduledDate);
                                    return (
                                        <div
                                            key={session.id}
                                            className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-green-200 dark:border-green-900/30 p-4 mb-3 last:mb-0 hover:border-green-500 transition relative overflow-hidden"
                                        >
                                            <div className="absolute right-0 top-0 w-24 h-24 bg-green-500/5 rounded-bl-full -mr-4 -mt-4"></div>

                                            <div className="flex justify-between items-start mb-3 relative z-10">
                                                <div>
                                                    <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                                                        Open to Join
                                                    </span>
                                                    <h4 className="text-base font-semibold mt-2 text-gray-900 dark:text-white capitalize">
                                                        {session.name}
                                                    </h4>
                                                </div>
                                                <div className="text-center border rounded-lg p-2 min-w-[60px] bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800/30">
                                                    <span className="block text-xs font-bold text-green-600 dark:text-green-400 uppercase">{month}</span>
                                                    <span className="block text-lg font-bold text-green-800 dark:text-green-200">{day}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-2 relative z-10">
                                                <span className="material-symbols-outlined text-lg">schedule</span>
                                                <span>{time}</span>
                                            </div>

                                            {(() => {
                                                const playersCount = (session.players || []).length;
                                                const limit = session.playerLimit || 0;
                                                const isFull = limit > 0 && playersCount >= limit;
                                                const waitlistCount = (session.waitlist || []).length;

                                                return (
                                                    <div className="mt-4">
                                                        <div className="flex justify-between text-xs mb-1 text-gray-500 dark:text-gray-400">
                                                            <span>{limit > 0 ? `${playersCount} / ${limit} Players` : `${playersCount} Players`}</span>
                                                            {waitlistCount > 0 && <span className="text-orange-600 font-bold">{waitlistCount} on Waitlist</span>}
                                                        </div>
                                                        <button
                                                            onClick={(e) => handleJoinSession(e, session.id)}
                                                            className={`w-full font-bold py-2 px-4 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 relative z-10 ${isFull
                                                                ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/50"
                                                                : "bg-green-600 hover:bg-green-700 text-white"
                                                                }`}
                                                        >
                                                            <span className="material-symbols-outlined text-lg">{isFull ? "hourglass_empty" : "person_add"}</span>
                                                            {isFull ? "Join Waitlist" : "Sign Up for Session"}
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    );
                                })}
                            </section>
                        )}

                        {/* UPCOMING / ALL SESSIONS */}
                        <section>
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

                            {visibleMySessions.length > 0 ? (
                                visibleMySessions.map(session => {
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
                                                            {session.waitlist && session.waitlist.includes(linkedPlayerId) ? "Waitlisted" : "Next Match"}
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

                                            {/* Player Counts & Leave Action - Only for future/upcoming */}
                                            {!isPast && (
                                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                            {session.playerLimit > 0
                                                                ? <>{(session.players || []).length} <span className="text-gray-400">/</span> {session.playerLimit} Players</>
                                                                : <>{(session.players || []).length} Players</>
                                                            }
                                                            {session.waitlist && session.waitlist.length > 0 && (
                                                                <span className="ml-2 text-orange-600 font-bold">
                                                                    (+{session.waitlist.length} Waitlist)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={(e) => handleLeaveSession(e, session.id)}
                                                        className="w-full py-1.5 px-3 rounded-lg border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <span className="material-symbols-outlined text-sm">logout</span>
                                                        Leave Session
                                                    </button>
                                                </div>
                                            )}

                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mt-2">
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
                    </div>
                )}

                {/* BETTING TAB */}
                {activeTab === 'betting' && (
                    <div className="space-y-6">
                        <section className="">
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
                                                        ${bet.amount} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">on</span> {bet.teamNameDisplay}
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
                )}
            </div>
        </DashboardLayout>
    );
};

export default UserDashboard;
