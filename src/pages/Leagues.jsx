import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc, where, updateDoc, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import LeagueModal from '../components/LeagueModal';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { completeSession } from '../services/SessionService';

const Leagues = () => {
    const [leagues, setLeagues] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [selectedLeague, setSelectedLeague] = useState(null);
    const navigate = useNavigate();

    const { currentUser } = useAuth();
    const { clubId, isAdmin } = useClub();

    useEffect(() => {
        if (!clubId) return;

        // REMOVED orderBy to avoid "Missing Index" error on creation
        const q = query(collection(db, 'leagues'), where('clubId', '==', clubId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leaguesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort client-side
            leaguesData.sort((a, b) => {
                if (!a.startDate) return 1;
                if (!b.startDate) return -1;
                return b.startDate.localeCompare(a.startDate);
            });
            setLeagues(leaguesData);
        });

        return () => unsubscribe();
    }, [clubId]);

    const handleAdd = () => {
        setSelectedLeague(null);
        setModalOpen(true);
    };

    const handleEdit = (e, league) => {
        e.stopPropagation();
        setSelectedLeague(league);
        setModalOpen(true);
    };

    const handleDelete = async (e, league) => {
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

    const handleToggleArchive = async (e, league) => {
        e.stopPropagation();
        try {
            // If we are ARCHIVING (currently not archived), we must close out all sessions
            if (!league.archived) {
                if (!window.confirm(`Archive ${league.name}? This will complete all sessions, settle bets, and refund unplayed bets.`)) {
                    return;
                }

                console.log(`Archiving league ${league.id}, completing all sessions...`);
                // Query sessions instead of weeks
                const sessionsQuery = query(collection(db, 'sessions'), where('leagueId', '==', league.id));
                const sessionsSnapshot = await getDocs(sessionsQuery);

                const completionPromises = sessionsSnapshot.docs.map(sessionDoc => completeSession(sessionDoc.id));
                await Promise.all(completionPromises);
                console.log("All sessions completed.");
            }

            await updateDoc(doc(db, 'leagues', league.id), {
                archived: !league.archived
            });
        } catch (error) {
            console.error("Error toggling archive:", error);
            alert("Error: " + error.message);
        }
    };

    const filteredLeagues = leagues.filter(l => showArchived ? true : !l.archived);

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedLeague(null);
    };

    return (
        <div className="w-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Leagues</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Manage your club's leagues</p>
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
                            onClick={handleAdd}
                            className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">add</span>
                            <span>Create League</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredLeagues.length > 0 ? (
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
                                            onClick={(e) => handleEdit(e, league)}
                                            className="p-1.5 text-gray-400 hover:text-primary hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                            title="Edit"
                                        >
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
                                        <button
                                            onClick={(e) => handleToggleArchive(e, league)}
                                            className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                                            title={league.archived ? "Unarchive" : "Archive"}
                                        >
                                            <span className="material-symbols-outlined text-lg">
                                                {league.archived ? 'unarchive' : 'archive'}
                                            </span>
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(e, league)}
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
                            <button onClick={handleAdd} className="mt-2 text-primary hover:underline text-sm font-medium">
                                Create your first league
                            </button>
                        )}
                    </div>
                )}
            </div>

            <LeagueModal
                open={modalOpen}
                onClose={handleCloseModal}
                league={selectedLeague}
            />
        </div>
    );
};

export default Leagues;
