import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc, where, updateDoc, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import LeagueModal from '../components/LeagueModal';
import SessionModal from '../components/SessionModal';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { completeSession } from '../services/SessionService';

const Leagues = () => {
    const [leagues, setLeagues] = useState([]);
    const [pickupSessions, setPickupSessions] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [sessionModalOpen, setSessionModalOpen] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [selectedLeague, setSelectedLeague] = useState(null);
    const [selectedSession, setSelectedSession] = useState(null);
    const [currentTab, setCurrentTab] = useState(0); // 0: Leagues, 1: Pickup
    const navigate = useNavigate();

    const { currentUser } = useAuth();
    const { clubId, isAdmin } = useClub();

    // Fetch Leagues
    useEffect(() => {
        if (!clubId) return;

        const q = query(collection(db, 'leagues'), where('clubId', '==', clubId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leaguesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            leaguesData.sort((a, b) => {
                if (!a.startDate) return 1;
                if (!b.startDate) return -1;
                return b.startDate.localeCompare(a.startDate);
            });
            setLeagues(leaguesData);
        });

        return () => unsubscribe();
    }, [clubId]);

    // Fetch Pickup Sessions
    useEffect(() => {
        if (!clubId) return;

        // Fetch sessions where clubId matches and leagueId is null
        const q = query(
            collection(db, 'sessions'),
            where('clubId', '==', clubId),
            where('leagueId', '==', null)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort by createdAt descending (newest first) or scheduledDate
            sessionsData.sort((a, b) => {
                const dateA = a.scheduledDate || a.createdAt?.toDate().toISOString() || '';
                const dateB = b.scheduledDate || b.createdAt?.toDate().toISOString() || '';
                return dateB.localeCompare(dateA);
            });
            setPickupSessions(sessionsData);
        });

        return () => unsubscribe();
    }, [clubId]);

    const handleAddLeague = () => {
        setSelectedLeague(null);
        setModalOpen(true);
    };

    const handleAddSession = () => {
        setSelectedSession(null);
        setSessionModalOpen(true);
    };

    const handleEditLeague = (e, league) => {
        e.stopPropagation();
        setSelectedLeague(league);
        setModalOpen(true);
    };

    const handleEditSession = (e, session) => {
        e.stopPropagation();
        setSelectedSession(session);
        setSessionModalOpen(true);
    };

    const handleDeleteLeague = async (e, league) => {
        e.stopPropagation();
        if (window.confirm(`Delete ${league.name}?`)) {
            try {
                await deleteDoc(doc(db, 'leagues', league.id));
            } catch (error) {
                console.error("Error deleting league:", error);
                alert("Error deleting league: " + error.message);
            }
        }
    };

    const handleDeleteSession = async (e, session) => {
        e.stopPropagation();
        if (window.confirm(`Delete ${session.name}?`)) {
            try {
                await deleteDoc(doc(db, 'sessions', session.id));
            } catch (error) {
                console.error("Error deleting session:", error);
            }
        }
    };

    const handleToggleArchiveLeague = async (e, league) => {
        e.stopPropagation();
        try {
            if (!league.archived) {
                if (!window.confirm(`Archive ${league.name}? This will complete all sessions, settle bets, and refund unplayed bets.`)) {
                    return;
                }

                console.log(`Archiving league ${league.id}, completing all sessions...`);
                const sessionsQuery = query(collection(db, 'sessions'), where('leagueId', '==', league.id));
                const sessionsSnapshot = await getDocs(sessionsQuery);

                const completionPromises = sessionsSnapshot.docs.map(sessionDoc => completeSession(sessionDoc.id));
                await Promise.all(completionPromises);
            }

            await updateDoc(doc(db, 'leagues', league.id), {
                archived: !league.archived
            });
        } catch (error) {
            console.error("Error toggling archive:", error);
            alert("Error: " + error.message);
        }
    };

    const handleToggleArchiveSession = async (e, session) => {
        e.stopPropagation();
        try {
            if (!session.archived) {
                if (!window.confirm(`Archive ${session.name}? This will complete the session, settle bets, and refund unplayed bets.`)) {
                    return;
                }
                await completeSession(session.id);
            }

            await updateDoc(doc(db, 'sessions', session.id), {
                archived: !session.archived
            });
        } catch (error) {
            console.error("Error toggling archive:", error);
            alert("Error: " + error.message);
        }
    };

    const filteredLeagues = leagues.filter(l => showArchived ? true : !l.archived);
    const filteredPickupSessions = pickupSessions.filter(s => showArchived ? true : !s.archived);

    return (
        <div className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Leagues & Sessions</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage leagues and pickup games</p>
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                        <div className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={(e) => setShowArchived(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                        </div>
                        <span>Show Archived</span>
                    </label>

                    {isAdmin && (
                        <button
                            onClick={currentTab === 0 ? handleAddLeague : handleAddSession}
                            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            <span>{currentTab === 0 ? 'Create League' : 'New Session'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <div className="flex gap-6">
                    <button
                        onClick={() => setCurrentTab(0)}
                        className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${currentTab === 0
                            ? 'text-primary'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                    >
                        Leagues
                        {currentTab === 0 && (
                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></span>
                        )}
                    </button>
                    <button
                        onClick={() => setCurrentTab(1)}
                        className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${currentTab === 1
                            ? 'text-primary'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                    >
                        Pickup Sessions
                        {currentTab === 1 && (
                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></span>
                        )}
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {currentTab === 0 ? (
                    filteredLeagues.length > 0 ? (
                        filteredLeagues.map((league) => (
                            <div
                                key={league.id}
                                onClick={() => navigate(`/clubs/${clubId}/leagues/${league.id}`)}
                                className={`bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border p-4 cursor-pointer transition-all hover:shadow-md hover:border-primary group h-full flex flex-col ${league.archived ? 'border-gray-200 dark:border-gray-700 opacity-75' : 'border-gray-200 dark:border-gray-700'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors line-clamp-1">
                                                {league.name}
                                            </h3>
                                            {league.archived && (
                                                <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0">Archived</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                            {league.type}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            {league.startDate} - {league.endDate}
                                        </p>
                                    </div>

                                    {isAdmin && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => handleEditLeague(e, league)}
                                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                                title="Edit"
                                            >
                                                <span className="material-symbols-outlined text-lg">edit</span>
                                            </button>
                                            <button
                                                onClick={(e) => handleToggleArchiveLeague(e, league)}
                                                className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                                title={league.archived ? "Unarchive" : "Archive"}
                                            >
                                                <span className="material-symbols-outlined text-lg">
                                                    {league.archived ? 'unarchive' : 'archive'}
                                                </span>
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteLeague(e, league)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                                title="Delete"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-auto pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span className="material-symbols-outlined text-sm">group</span>
                                    <span>{league.players ? league.players.length : 0} Players</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-10 bg-surface-light dark:bg-surface-dark rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">No leagues found.</p>
                            {isAdmin && (
                                <button onClick={handleAddLeague} className="mt-2 text-primary hover:underline text-sm font-medium">
                                    Create your first league
                                </button>
                            )}
                        </div>
                    )
                ) : (
                    // PICKUP SESSIONS TAB
                    filteredPickupSessions.length > 0 ? (
                        filteredPickupSessions.map((session) => (
                            <div
                                key={session.id}
                                onClick={() => navigate(`/clubs/${clubId}/sessions/${session.id}`)}
                                className={`bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border p-4 cursor-pointer hover:border-primary transition-all group relative ${session.archived ? 'border-gray-200 dark:border-gray-700 opacity-75' : 'border-gray-200 dark:border-gray-700'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary transition-colors">
                                                {session.name}
                                            </h3>
                                            {session.archived && (
                                                <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0">Archived</span>
                                            )}
                                        </div>
                                    </div>
                                    {isAdmin && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-surface-light dark:bg-surface-dark p-1 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                            <button
                                                onClick={(e) => handleEditSession(e, session)}
                                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                                title="Edit"
                                            >
                                                <span className="material-symbols-outlined text-base">edit</span>
                                            </button>
                                            <button
                                                onClick={(e) => handleToggleArchiveSession(e, session)}
                                                className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                                title={session.archived ? "Unarchive" : "Archive"}
                                            >
                                                <span className="material-symbols-outlined text-base">
                                                    {session.archived ? 'unarchive' : 'archive'}
                                                </span>
                                            </button>
                                            <button
                                                onClick={(e) => handleDeleteSession(e, session)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                                title="Delete"
                                            >
                                                <span className="material-symbols-outlined text-base">delete</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    {session.scheduledDate && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                            <span className="material-symbols-outlined text-base text-gray-400">calendar_today</span>
                                            <span>{new Date(session.scheduledDate).toLocaleDateString()}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                        <span className="material-symbols-outlined text-base text-gray-400">sports_tennis</span>
                                        <span>{session.gamesPerPlayer ? `${session.gamesPerPlayer} Rounds` : 'Rounds not set'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                        <span className="material-symbols-outlined text-base text-gray-400">group</span>
                                        <span>{session.players ? session.players.length : 0} Players</span>
                                    </div>
                                    {session.status === 'COMPLETED' && (
                                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                            <span className="material-symbols-outlined text-sm">check_circle</span>
                                            COMPLETED
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-10 bg-surface-light dark:bg-surface-dark rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">No pickup sessions found.</p>
                            {isAdmin && (
                                <button onClick={handleAddSession} className="mt-2 text-primary hover:underline text-sm font-medium">
                                    Start a new session
                                </button>
                            )}
                        </div>
                    )
                )}
            </div>

            <LeagueModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                league={selectedLeague}
            />

            <SessionModal
                open={sessionModalOpen}
                onClose={() => setSessionModalOpen(false)}
                session={selectedSession}
                league={null}
                clubId={clubId}
            />
        </div>
    );
};

export default Leagues;
