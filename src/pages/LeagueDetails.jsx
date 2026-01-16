import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import SessionModal from '../components/SessionModal';
import LeagueModal from '../components/LeagueModal';
import { calculateStandings } from '../utils/standingsCalculator';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';

const LeagueDetails = () => {
    const { currentUser } = useAuth();
    const { clubId, isAdmin } = useClub();
    const { id } = useParams();
    const navigate = useNavigate();
    const [league, setLeague] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sessionModalOpen, setSessionModalOpen] = useState(false);
    const [leagueModalOpen, setLeagueModalOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState(null);

    // Tab State
    const [currentTab, setCurrentTab] = useState(0);
    const [standings, setStandings] = useState([]);

    // If Open Play, default to Sessions tab (1)
    useEffect(() => {
        if (league && league.type === 'Open Play') {
            setCurrentTab(1);
        }
    }, [league]);

    useEffect(() => {
        const fetchLeague = async () => {
            try {
                const docRef = doc(db, 'leagues', id);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setLeague({ id: docSnap.id, ...docSnap.data() });
                } else {
                    console.log("No such league!");
                    navigate('/');
                }
            } catch (error) {
                console.error("Error fetching league:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLeague();
    }, [id, navigate]);

    // Fetch Sessions and Calculate Standings
    useEffect(() => {
        const q = query(collection(db, 'sessions'), where('leagueId', '==', id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort sessions by name or creation date if possible. 
            // For now, simple sort.
            sessionsData.sort((a, b) => a.name.localeCompare(b.name));
            setSessions(sessionsData);
        });

        return () => unsubscribe();
    }, [id]);

    // Fetch Players (Needed for Standings)
    useEffect(() => {
        if (!league || !league.players) return;

        // In a real app with many players, we might optimize this.
        // For now, fetch all and filter.
        const q = query(collection(db, 'players'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allPlayers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const leaguePlayers = allPlayers.filter(p => league.players.includes(p.id));
            setPlayers(leaguePlayers);
        });
        return () => unsubscribe();
    }, [league]);

    // Recalculate Standings whenever Sessions or Players change
    useEffect(() => {
        if (league && league.type === 'Open Play') {
            setStandings([]);
            return;
        }
        if (players.length > 0 && sessions.length > 0) {
            const newStandings = calculateStandings(players, sessions);
            setStandings(newStandings);
        }
    }, [players, sessions, league]);

    const handleDelete = async (e, session) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete ${session.name}?`)) {
            try {
                await deleteDoc(doc(db, 'sessions', session.id));
            } catch (error) {
                console.error("Error deleting session:", error);
            }
        }
    };

    const handleEdit = (e, session) => {
        e.stopPropagation();
        setSelectedSession(session);
        setSessionModalOpen(true);
    };

    const handleAddSession = () => {
        setSelectedSession(null);
        setSessionModalOpen(true);
    };

    const handleEditLeague = () => {
        setLeagueModalOpen(true);
    }

    if (loading) return (
        <div className="flex justify-center items-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );

    if (!league) return <div className="p-4 text-center">League not found</div>;

    return (
        <div className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/clubs/${clubId}/leagues`)}
                        className="p-2 -ml-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            {league.name}
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {league.type} League
                        </p>
                    </div>
                </div>

                {isAdmin && (
                    <button
                        onClick={handleEditLeague}
                        className="text-primary hover:text-primary-dark font-semibold text-sm flex items-center gap-1 transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">edit</span>
                        Edit League
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
                <div className="flex gap-6">
                    {league.type !== 'Open Play' && (
                        <button
                            onClick={() => setCurrentTab(0)}
                            className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${currentTab === 0
                                ? 'text-primary'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                                }`}
                        >
                            Standings
                            {currentTab === 0 && (
                                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></span>
                            )}
                        </button>
                    )}
                    <button
                        onClick={() => setCurrentTab(1)}
                        className={`pb-3 px-1 text-sm font-semibold transition-colors relative ${currentTab === 1
                            ? 'text-primary'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                    >
                        Sessions
                        {currentTab === 1 && (
                            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></span>
                        )}
                    </button>
                </div>
            </div>

            {/* Content: Standings */}
            {currentTab === 0 && league.type !== 'Open Play' && (
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-3 font-semibold">Rank</th>
                                    <th className="px-6 py-3 font-semibold">Player</th>
                                    <th className="px-6 py-3 font-semibold text-right">Wins</th>
                                    <th className="px-6 py-3 font-semibold text-right">Losses</th>
                                    <th className="px-6 py-3 font-semibold text-right">PF</th>
                                    <th className="px-6 py-3 font-semibold text-right">PA</th>
                                    <th className="px-6 py-3 font-semibold text-right">Diff</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
                                {standings.map((row) => (
                                    <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{row.rank}</td>
                                        <td className="px-6 py-4 font-medium">{row.name}</td>
                                        <td className="px-6 py-4 text-right">{row.wins}</td>
                                        <td className="px-6 py-4 text-right">{row.losses}</td>
                                        <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{row.pointsFor}</td>
                                        <td className="px-6 py-4 text-right text-gray-500 dark:text-gray-400">{row.pointsAgainst}</td>
                                        <td className={`px-6 py-4 text-right font-bold ${row.diff > 0 ? 'text-green-600 dark:text-green-400' :
                                            row.diff < 0 ? 'text-red-500 dark:text-red-400' :
                                                'text-gray-500 dark:text-gray-400'
                                            }`}>
                                            {row.diff > 0 ? `+${row.diff}` : row.diff}
                                        </td>
                                    </tr>
                                ))}
                                {standings.length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                            No standings available yet. Complete some matches!
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Content: Sessions */}
            {currentTab === 1 && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white">All Sessions</h2>
                        {isAdmin && (
                            <button
                                onClick={handleAddSession}
                                className="bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-lg">add</span>
                                Add Session
                            </button>
                        )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                onClick={() => navigate(`/clubs/${clubId}/leagues/${id}/sessions/${session.id}`)}
                                className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:border-primary transition-all group relative"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-gray-900 dark:text-white text-lg group-hover:text-primary transition-colors">
                                        {session.name}
                                    </h3>
                                    {isAdmin && (
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 bg-surface-light dark:bg-surface-dark p-1 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                                            <button
                                                onClick={(e) => handleEdit(e, session)}
                                                className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                                title="Edit"
                                            >
                                                <span className="material-symbols-outlined text-base">edit</span>
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(e, session)}
                                                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                                title="Delete"
                                            >
                                                <span className="material-symbols-outlined text-base">delete</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
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
                        ))}
                    </div>

                    {sessions.length === 0 && (
                        <div className="text-center py-10 bg-surface-light dark:bg-surface-dark rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                            <p className="text-gray-500 dark:text-gray-400">No sessions found.</p>
                            {isAdmin && (
                                <button onClick={handleAddSession} className="mt-2 text-primary hover:underline text-sm font-medium">
                                    Create your first session
                                </button>
                            )}
                        </div>
                    )}
                </>
            )}

            <SessionModal
                open={sessionModalOpen}
                onClose={() => setSessionModalOpen(false)}
                session={selectedSession}
                league={league}
                clubId={clubId}
            />

            <LeagueModal
                open={leagueModalOpen}
                onClose={() => setLeagueModalOpen(false)}
                league={league}
            />
        </div>
    );
};

export default LeagueDetails;
