import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import NotificationBell from './NotificationBell';

const DashboardLayout = ({ children }) => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Data States
    const [myClubs, setMyClubs] = useState([]);
    const [expandedClubId, setExpandedClubId] = useState(null);

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
        // Fetch User's Clubs (Real-time listener for menu)
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
                        <NotificationBell />
                        <div
                            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-sm font-bold border-2 border-white/20 cursor-pointer hover:opacity-80 transition"
                            onClick={handleAvatarClick}
                            title="Click to logout"
                        >
                            {getInitials(currentUser)}
                        </div>
                    </div>
                </header>

                <main className="px-4 py-6 w-full mx-auto max-w-md lg:max-w-7xl pb-10 flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
