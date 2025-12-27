import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';

const UserDashboard = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Data States
    const [upcomingWeeks, setUpcomingWeeks] = useState([]);
    const [openBets, setOpenBets] = useState([]);
    const [myClubs, setMyClubs] = useState([]);
    const [expandedClubId, setExpandedClubId] = useState(null);
    const [loading, setLoading] = useState(true);

    // UI States
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    // Default to pinned if screen is large enough (lg breakpoint is 1024px usually)
    const [isPinned, setIsPinned] = useState(window.innerWidth >= 1024);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsPinned(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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

                // 2. Fetch Upcoming Weeks
                if (linkedPlayerId) {
                    const weeksRef = collection(db, 'weeks');
                    const qWeeks = query(weeksRef, where('players', 'array-contains', linkedPlayerId));
                    const weeksSnap = await getDocs(qWeeks);

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const validWeeks = weeksSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(w => {
                            if (!w.scheduledDate) return false;
                            const d = w.scheduledDate.toDate ? w.scheduledDate.toDate() : new Date(w.scheduledDate);
                            return d >= today;
                        })
                        .sort((a, b) => {
                            const dateA = a.scheduledDate.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
                            const dateB = b.scheduledDate.toDate ? b.scheduledDate.toDate() : new Date(b.scheduledDate);
                            return dateA - dateB;
                        });

                    setUpcomingWeeks(validWeeks);
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

        // 4. Fetch User's Clubs (Real-time listener for menu)
        let unsubscribeClubs = () => { };
        if (currentUser) {
            const qClubs = query(collection(db, 'clubs'), where('members', 'array-contains', currentUser.uid));
            unsubscribeClubs = onSnapshot(qClubs, (snapshot) => {
                const clubsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMyClubs(clubsData);
                // Expand first club by default if none selected
                if (clubsData.length > 0 && !expandedClubId) {
                    setExpandedClubId(clubsData[0].id);
                }
            });
        }

        fetchData();

        return () => {
            unsubscribeClubs();
        };
    }, [currentUser]);

    const getInitials = (user) => {
        if (!user) return '??';
        if (user.displayName) {
            const names = user.displayName.trim().split(' ');
            if (names.length >= 2) return `${names[0][0]}${names[1][0]}`.toUpperCase();
            return names[0].substring(0, 2).toUpperCase();
        }
        return user.email ? user.email.substring(0, 2).toUpperCase() : '??';
    };

    const formatDate = (dateObj) => {
        const d = dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
        return {
            month: d.toLocaleString('default', { month: 'short' }),
            day: d.getDate(),
            time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
    };

    // Simple logout handler for the avatar click (temporary interaction)
    const handleAvatarClick = async () => {
        if (window.confirm("Do you want to logout?")) {
            try {
                await logout();
            } catch (error) {
                console.error("Failed to log out", error);
            }
        }
    };

    const toggleClub = (clubId) => {
        setExpandedClubId(expandedClubId === clubId ? null : clubId);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-background-light dark:bg-background-dark">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-background-light dark:bg-background-dark text-gray-900 dark:text-gray-100 font-sans">
            {/* Sidebar Overlay (Only when Unpinned and Open) */}
            {!isPinned && isMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                    onClick={() => setIsMenuOpen(false)}
                ></div>
            )}

            {/* Sidebar */}
            <aside
                className={`
                    ${isPinned ? 'relative translate-x-0' : 'fixed top-0 left-0 bottom-0 shadow-xl'}
                    ${!isPinned && !isMenuOpen ? '-translate-x-full' : 'translate-x-0'}
                    w-64 bg-sidebar-dark text-white z-50 transition-transform duration-300 ease-in-out flex-shrink-0 overflow-y-auto
                `}
            >
                <div className="p-4 flex justify-between items-center border-b border-white/10">
                    <h2 className="text-xl font-bold">Menu</h2>
                    <div className="flex items-center">
                        {/* Pin Toggle Button (Desktop Only) */}
                        <button
                            onClick={() => setIsPinned(!isPinned)}
                            className="hidden lg:block p-1 rounded hover:bg-white/10 mr-1"
                            title={isPinned ? "Unpin Menu" : "Pin Menu"}
                        >
                            <span className="material-symbols-outlined text-sm transform rotate-45">
                                {isPinned ? 'push_pin' : 'keep_off'}
                            </span>
                        </button>
                        {/* Close Button (Visible when NOT pinned) */}
                        {!isPinned && (
                            <button onClick={() => setIsMenuOpen(false)} className="p-1 rounded hover:bg-white/10">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        )}
                    </div>
                </div>
                <nav className="p-2 space-y-1">
                    <div
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 cursor-pointer"
                        onClick={() => { navigate('/'); if (!isPinned) setIsMenuOpen(false); }}
                    >
                        <span className="material-symbols-outlined">dashboard</span>
                        <span className="font-medium">Dashboard</span>
                    </div>

                    <div className="border-t border-white/10 my-2 pt-2">
                        <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">My Clubs</p>
                        {myClubs.map(club => (
                            <div key={club.id} className="mb-2">
                                <div
                                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/10 cursor-pointer"
                                    onClick={() => toggleClub(club.id)}
                                >
                                    <span className="font-medium truncate">{club.name}</span>
                                    <span className={`material-symbols-outlined text-sm transition-transform ${expandedClubId === club.id ? 'rotate-180' : ''}`}>expand_more</span>
                                </div>

                                {expandedClubId === club.id && (
                                    <div className="ml-4 mt-1 space-y-1 border-l-2 border-white/10 pl-2">
                                        {[
                                            { name: 'Leagues', icon: 'emoji_events', path: `/clubs/${club.id}/leagues` },
                                            { name: 'Players', icon: 'group', path: `/clubs/${club.id}/players` },
                                            { name: 'High Rollers', icon: 'paid', path: `/clubs/${club.id}/high-rollers` },
                                            { name: 'Calendar', icon: 'calendar_month', path: `/clubs/${club.id}/calendar` }
                                        ].map(item => (
                                            <div
                                                key={item.name}
                                                className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-gray-300 hover:text-white hover:bg-white/10 cursor-pointer"
                                                onClick={() => { navigate(item.path); if (!isPinned) setIsMenuOpen(false); }}
                                            >
                                                <span className="material-symbols-outlined text-lg">{item.icon}</span>
                                                <span>{item.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="border-t border-white/10 my-2 pt-2">
                        <div
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 cursor-pointer text-red-300 hover:text-red-200"
                            onClick={handleAvatarClick}
                        >
                            <span className="material-symbols-outlined">logout</span>
                            <span className="font-medium">Logout</span>
                        </div>
                    </div>
                </nav>
            </aside>

            {/* Main Content Wrapper */}
            <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">
                <header className="bg-sidebar-dark text-white px-4 py-4 sticky top-0 z-30 shadow-md flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        {/* Only show hamburger if NOT pinned */}
                        {!isPinned && (
                            <button
                                className="p-1 rounded-full hover:bg-white/10 transition"
                                onClick={() => setIsMenuOpen(true)}
                            >
                                <span className="material-symbols-outlined text-2xl">menu</span>
                            </button>
                        )}
                        <h1 className="text-lg font-semibold tracking-wide">Pickleball League</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="relative p-1 rounded-full hover:bg-white/10 transition">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-sidebar-dark"></span>
                        </button>
                        <div
                            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold border-2 border-white/20 cursor-pointer hover:opacity-80 transition"
                            onClick={handleAvatarClick}
                            title="Click to logout"
                        >
                            {getInitials(currentUser)}
                        </div>
                    </div>
                </header>

                <main className="px-4 py-6 max-w-md mx-auto w-full pb-10 flex-1">
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

                    <section className="mb-6">
                        <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2 text-gray-800 dark:text-white">
                                <span className="material-symbols-outlined text-primary">sports_tennis</span>
                                <h3 className="text-lg font-bold">Upcoming Schedule</h3>
                            </div>
                            <button className="text-xs font-semibold text-primary hover:text-primary-dark" onClick={() => alert("Go to schedule/calendar")}>View All</button>
                        </div>

                        {upcomingWeeks.length > 0 ? (
                            upcomingWeeks.map(week => {
                                const { month, day, time } = formatDate(week.scheduledDate);
                                return (
                                    <div
                                        key={week.id}
                                        className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-3 last:mb-0 cursor-pointer hover:border-primary transition"
                                        onClick={() => navigate(`/clubs/${week.clubId || 'unknown'}/leagues/${week.leagueId}/weeks/${week.id}`)}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                                                    Next Match
                                                </span>
                                                <h4 className="text-base font-semibold mt-2 text-gray-900 dark:text-white capitalize">
                                                    {week.name}
                                                </h4>
                                            </div>
                                            <div className="text-center bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-lg p-2 min-w-[60px]">
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
                                No upcoming matches scheduled.
                            </div>
                        )}
                    </section>

                    <section className="mb-6">
                        <div className="flex items-center gap-2 mb-3 text-gray-800 dark:text-white">
                            <span className="material-symbols-outlined text-orange-500">emoji_events</span>
                            <h3 className="text-lg font-bold">Active Bets ({openBets.length})</h3>
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
                </main>
            </div>
        </div>
    );
};

export default UserDashboard;
