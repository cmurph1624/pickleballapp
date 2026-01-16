import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, getDocs, limit, where, onSnapshot, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';
import { generateMatches } from '../utils/matchGenerator';
import { calculateSpread } from '../services/Oddsmaker';
import { validateSchedule } from '../utils/scheduleValidator';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { completeSession, substitutePlayer } from '../services/SessionService';
import { calculateStandings } from '../utils/standingsCalculator';

import ScoreModal from '../components/ScoreModal';
import PlaceBetModal from '../components/PlaceBetModal';
import MatchFrequencyModal from '../components/MatchFrequencyModal';
import SessionScorecard from '../components/SessionScorecard';
import SubstitutePlayerModal from '../components/SubstitutePlayerModal';

import ReviewBetsModal from '../components/ReviewBetsModal';

const SessionDetails = () => {
    const { currentUser } = useAuth();
    const { isAdmin, clubId } = useClub();
    const { leagueId, sessionId } = useParams();
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [players, setPlayers] = useState([]);
    const [allAvailablePlayers, setAllAvailablePlayers] = useState([]);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [matchmakingMode, setMatchmakingMode] = useState('STRICT_SOCIAL');

    // Score Modal State
    const [scoreModalOpen, setScoreModalOpen] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState(null);

    // Betting Modal State
    const [betModalOpen, setBetModalOpen] = useState(false);
    const [selectedBetMatch, setSelectedBetMatch] = useState(null);

    // Frequency Modal State
    const [frequencyModalOpen, setFrequencyModalOpen] = useState(false);

    // Review Bets Modal State
    const [reviewBetsModalOpen, setReviewBetsModalOpen] = useState(false);
    const [selectedReviewMatch, setSelectedReviewMatch] = useState(null);

    // Substitute Modal State
    const [substituteModalOpen, setSubstituteModalOpen] = useState(false);

    const [currentTab, setCurrentTab] = useState(0); // 0: Matches, 1: Standings
    const [standings, setStandings] = useState([]);

    const [hasBets, setHasBets] = useState(false);

    useEffect(() => {
        setLoading(true);

        // 1. Session Listener
        const sessionRef = doc(db, 'sessions', sessionId);
        const unsubscribeSession = onSnapshot(sessionRef, async (docSnap) => {
            if (!docSnap.exists()) {
                navigate('/');
                return;
            }
            const sessionData = { id: docSnap.id, ...docSnap.data() };
            setSession(sessionData);
            setMatches(sessionData.matches || []);

            // Fetch Players if needed (diffing could be optimized, but this is safe)
            if (sessionData.players && sessionData.players.length > 0) {
                try {
                    // optimization: only fetch if players changed or not yet loaded
                    const playersQuery = query(collection(db, 'players'));
                    const playersSnap = await getDocs(playersQuery);
                    const allPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setAllAvailablePlayers(allPlayers);
                    const sessionPlayers = allPlayers.filter(p => sessionData.players.includes(p.id));
                    setPlayers(sessionPlayers);
                } catch (err) {
                    console.error("Error fetching players in snapshot:", err);
                }
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to session:", error);
            setLoading(false);
        });

        // 2. Bets Listener (to lock generation if bets exist)
        const betsQuery = query(
            collection(db, 'bets'),
            where('weekId', '==', sessionId),
            limit(1)
        );
        const unsubscribeBets = onSnapshot(betsQuery, (snapshot) => {
            setHasBets(!snapshot.empty);
        }, (error) => {
            console.error("Error listening to bets:", error);
        });

        // Cleanup listeners on unmount
        return () => {
            unsubscribeSession();
            unsubscribeBets();
        };
    }, [sessionId, navigate]);

    // Calculate Standings whenever matches/players change
    useEffect(() => {
        if (players.length > 0 && matches.length > 0 && session) {
            const sessionWithMatches = { ...session, matches };
            const newStandings = calculateStandings(players, [sessionWithMatches]);
            setStandings(newStandings);
        }
    }, [players, matches, session]);

    const handleGenerateMatches = async () => {
        if (!session || !players.length) return;

        const gamesPerPlayer = session.gamesPerPlayer || 4;
        let newMatches = generateMatches(players, gamesPerPlayer, matchmakingMode);

        // Calculate Spreads for each match
        newMatches = newMatches.map(match => {
            const team1Players = players.filter(p => match.team1.includes(p.id));
            const team2Players = players.filter(p => match.team2.includes(p.id));
            const { spread, favoriteTeam } = calculateSpread(team1Players, team2Players);
            return { ...match, spread, favoriteTeam };
        });

        setMatches(newMatches);

        // Validation Step
        const validation = validateSchedule(newMatches, players);
        if (!validation.isValid) {
            console.error(validation.error);
            alert(validation.error);
            return;
        }

        // Save to Firestore
        try {
            await updateDoc(doc(db, 'sessions', sessionId), {
                matches: newMatches
            });
        } catch (error) {
            console.error("Error saving matches:", error);
            alert("Error saving matches: " + error.message);
        }
    };

    const handleRecalculateSpreads = async () => {
        if (!session || !matches.length) return;
        if (!window.confirm("Recalculate spreads for all existing matches based on current player ratings?")) return;

        setLoading(true);
        try {
            const updatedMatches = matches.map(match => {
                const team1Players = players.filter(p => match.team1.includes(p.id));
                const team2Players = players.filter(p => match.team2.includes(p.id));
                const { spread, favoriteTeam } = calculateSpread(team1Players, team2Players);
                return { ...match, spread, favoriteTeam };
            });

            await updateDoc(doc(db, 'sessions', sessionId), {
                matches: updatedMatches
            });
            // Update local state immediately to reflect changes
            setMatches(updatedMatches);
            alert("Spreads recalculated successfully.");
        } catch (error) {
            console.error("Error recalculating spreads:", error);
            alert("Error recalculating spreads: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleClearMatches = async () => {
        if (window.confirm("Are you sure you want to clear all matches?")) {
            setMatches([]);
            try {
                await updateDoc(doc(db, 'sessions', sessionId), {
                    matches: []
                });
            } catch (error) {
                console.error("Error clearing matches:", error);
            }
        }
    };

    const handleMatchClick = (match) => {
        setSelectedMatch(match);
        setScoreModalOpen(true);
    };

    const handleBetClick = (match) => {
        setSelectedBetMatch(match);
        setBetModalOpen(true);
    };

    const handleReviewBetsClick = (match) => {
        setSelectedReviewMatch(match);
        setReviewBetsModalOpen(true);
    };

    const handleSaveScore = async (matchId, team1Score, team2Score) => {
        try {
            await runTransaction(db, async (transaction) => {
                const sessionRef = doc(db, 'sessions', sessionId);
                const sessionDoc = await transaction.get(sessionRef);
                if (!sessionDoc.exists()) {
                    throw new Error("Session does not exist!");
                }

                const currentMatches = sessionDoc.data().matches || [];
                const updatedMatches = currentMatches.map(m => {
                    if (m.id === matchId) {
                        return { ...m, team1Score, team2Score };
                    }
                    return m;
                });

                transaction.update(sessionRef, { matches: updatedMatches });
            });
            // setMatches is not needed because onSnapshot listener will update the state
        } catch (error) {
            console.error("Error saving score:", error);
            alert("Error saving score: " + error.message);
        }
    };

    const handleCompleteSession = async () => {
        if (!window.confirm("Are you sure you want to COMPLETE this session? This will update player ratings, resolve bets (and refund unplayed ones), and lock the session.")) {
            return;
        }

        try {
            setLoading(true);
            const updatedPlayers = await completeSession(sessionId);

            setSession(prev => ({ ...prev, status: 'COMPLETED' }));
            if (updatedPlayers) {
                setPlayers(updatedPlayers);
            }
            alert("Session completed successfully!");

        } catch (error) {
            console.error("Error completing session:", error);
            alert("Error completing session: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubstitutePlayer = async (playerOutId, playerInId) => {
        try {
            setLoading(true);
            await substitutePlayer(sessionId, playerOutId, playerInId);

            // Reload data to reflect all changes (players, matches, bets)
            // Re-fetch Session
            const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
            const sessionData = { id: sessionDoc.id, ...sessionDoc.data() };
            setSession(sessionData);
            setMatches(sessionData.matches || []);

            // Re-calc players
            const newSessionPlayers = allAvailablePlayers.filter(p => sessionData.players.includes(p.id));
            setPlayers(newSessionPlayers);

            alert("Player substituted successfully. Bets have been settled.");
            setSubstituteModalOpen(false);
        } catch (error) {
            console.error("Error substituting player:", error);
            alert("Error substituting player: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const getPlayerName = (id) => {
        const p = players.find(player => player.id === id);
        return p ? `${p.firstName} ${p.lastName.substring(0, 1)}` : 'Unknown';
    };

    const getTeamNames = (match) => {
        if (!match) return { team1: '', team2: '' };
        const t1 = `${getPlayerName(match.team1[0])} & ${getPlayerName(match.team1[1])}`;
        const t2 = `${getPlayerName(match.team2[0])} & ${getPlayerName(match.team2[1])}`;
        return { team1: t1, team2: t2 };
    };

    if (loading) return (
        <div className="flex justify-center items-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );

    if (!session) return <div className="p-4 text-center">Session not found</div>;

    const printStyles = `
        @media print {
            @page {
                size: landscape;
                margin: 0.5in;
            }
            body { 
                visibility: hidden; 
                background-color: white !important;
                -webkit-print-color-adjust: exact;
            }
            #session-content-root {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                visibility: visible;
            }
            .screen-only {
                display: none !important;
            }
            .print-only {
                display: block !important;
                visibility: visible;
            }
            * {
                color: black !important;
                opacity: 1 !important;
                text-shadow: none !important;
                filter: none !important;
                -webkit-text-fill-color: black !important;
            }
        }
        .print-only {
            display: none;
        }
    `;

    return (
        <div id="session-content-root" className="w-full">
            <style>{printStyles}</style>

            <div className="print-only">
                <SessionScorecard sessionName={session.name} matches={matches} players={players} courts={session.courts || []} />
            </div>

            <div className="screen-only">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                if (leagueId) {
                                    navigate(`/clubs/${clubId}/leagues/${leagueId}`);
                                } else {
                                    navigate(`/clubs/${clubId}/leagues`); // Go back to Leagues/Sessions hub
                                }
                            }}
                            className="p-2 -ml-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors no-print"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                {session.name}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Players: {players.length} | Target Rounds: {session.gamesPerPlayer || 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Control Bar */}
                {isAdmin && (
                    <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
                        {session.status === 'COMPLETED' ? (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-lg">
                                <span className="material-symbols-outlined">lock</span>
                                Session Completed
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                    <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                                        <button
                                            onClick={() => setMatchmakingMode('STRICT_SOCIAL')}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${matchmakingMode === 'STRICT_SOCIAL' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                                            title="Prioritize mixing everyone together"
                                        >
                                            Social
                                        </button>
                                        <button
                                            onClick={() => setMatchmakingMode('WEIGHTED_COMPETITIVE')}
                                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${matchmakingMode === 'WEIGHTED_COMPETITIVE' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                                            title="Prioritize balanced games by HiddenRanking"
                                        >
                                            Competitive
                                        </button>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleGenerateMatches}
                                            disabled={matches.some(m => m.team1Score !== undefined || m.team2Score !== undefined) || hasBets}
                                            className="bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-lg">autorenew</span>
                                            Generate
                                        </button>
                                        <button
                                            onClick={handleRecalculateSpreads}
                                            disabled={loading || matches.length === 0 || hasBets}
                                            className="border border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
                                            title="Recalculate spreads based on current ratings"
                                        >
                                            <span className="material-symbols-outlined text-lg">calculate</span>
                                            Recalc Spreads
                                        </button>
                                        {matches.length > 0 && (
                                            <button
                                                onClick={handleClearMatches}
                                                disabled={matches.some(m => m.team1Score !== undefined || m.team2Score !== undefined) || hasBets}
                                                className="border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    {matches.length > 0 && (
                                        <>
                                            <button
                                                onClick={() => setSubstituteModalOpen(true)}
                                                className="border border-orange-200 text-orange-600 hover:bg-orange-50 dark:border-orange-900/50 dark:text-orange-400 dark:hover:bg-orange-900/20 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
                                            >
                                                Swap Player
                                            </button>
                                            <button
                                                onClick={() => setFrequencyModalOpen(true)}
                                                className="border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">analytics</span>
                                                Analysis
                                            </button>
                                            <button
                                                onClick={() => window.print()}
                                                className="border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">print</span>
                                                Print
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={handleCompleteSession}
                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors shadow-sm ml-auto sm:ml-0"
                                    >
                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                        Complete Session
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

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
                            Matches
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
                            Standings
                            {currentTab === 1 && (
                                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></span>
                            )}
                        </button>
                    </div>
                </div>

                {currentTab === 0 && (
                    <>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Matches ({matches.length})</h2>

                        {/* Match List */}
                        <div className="space-y-8">
                            {(() => {
                                const matchesPerRound = Math.floor(players.length / 4);
                                const chunkSize = matchesPerRound > 0 ? matchesPerRound : 1;
                                const rounds = [];
                                for (let i = 0; i < matches.length; i += chunkSize) {
                                    rounds.push(matches.slice(i, i + chunkSize));
                                }

                                return rounds.map((roundMatches, roundIndex) => (
                                    <div key={roundIndex} className="print-break-inside">
                                        <h3 className="text-lg font-semibold text-primary mb-3 pb-1 border-b border-gray-200 dark:border-gray-700">
                                            Round {roundIndex + 1}
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {roundMatches.map((match, matchIndex) => (
                                                <div
                                                    key={match.id || matchIndex}
                                                    onClick={() => {
                                                        if (session.status !== 'COMPLETED') {
                                                            handleMatchClick(match);
                                                        }
                                                    }}
                                                    className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl p-4 cursor-pointer hover:border-primary transition-all shadow-sm hover:shadow-md group relative"
                                                >
                                                    {/* Header: Label and Spread */}
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                                                                {(() => {
                                                                    const rawName = session.courts && session.courts[matchIndex] ? session.courts[matchIndex] : `Match ${matchIndex + 1}`;
                                                                    // If it's just a number (e.g. "1"), display as "Court 1"
                                                                    return /^\d+$/.test(rawName) ? `Court ${rawName}` : rawName;
                                                                })()}
                                                            </span>
                                                            {match.spread !== undefined && (
                                                                <span className="block text-xs font-bold text-primary mt-0.5">
                                                                    {match.spread === 0 ? "Pick 'em" :
                                                                        match.favoriteTeam === 1 ? `Team 1 (-${match.spread})` :
                                                                            match.favoriteTeam === 2 ? `Team 2 (-${match.spread})` : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {(match.team1Score !== undefined && match.team2Score !== undefined) ? (
                                                            <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white px-2 py-1 rounded text-sm font-bold">
                                                                {match.team1Score} - {match.team2Score}
                                                            </div>
                                                        ) : (
                                                            <div className="bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 px-2 py-1 rounded text-xs">
                                                                Score
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Players */}
                                                    <div className="flex items-center justify-between">
                                                        {/* Team 1 */}
                                                        <div className="flex-1 text-center">
                                                            <div className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                                                                {getPlayerName(match.team1[0])}
                                                            </div>
                                                            <div className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                                                                {getPlayerName(match.team1[1])}
                                                            </div>
                                                        </div>

                                                        {/* VS Badge */}
                                                        <div className="mx-2 flex-shrink-0">
                                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs font-bold">
                                                                VS
                                                            </span>
                                                        </div>

                                                        {/* Team 2 */}
                                                        <div className="flex-1 text-center">
                                                            <div className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                                                                {getPlayerName(match.team2[0])}
                                                            </div>
                                                            <div className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                                                                {getPlayerName(match.team2[1])}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Betting Button */}
                                                    {session.bettingDeadline && new Date() < new Date(session.bettingDeadline) && match.team1Score === undefined && session.status !== 'COMPLETED' && (
                                                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleBetClick(match);
                                                                }}
                                                                className="flex-1 text-center text-xs font-bold text-primary hover:text-primary-dark py-1 rounded hover:bg-primary/5 transition-colors"
                                                            >
                                                                Place Bet
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleReviewBetsClick(match);
                                                                }}
                                                                className="flex-1 text-center text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 py-1 rounded hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                                                            >
                                                                Review Bets
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}

                            {matches.length === 0 && (
                                <div className="text-center py-10 bg-surface-light dark:bg-surface-dark rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                                    <p className="text-gray-500 dark:text-gray-400">No matches generated yet.</p>
                                    {isAdmin && (
                                        <p className="text-sm text-gray-400 mt-1">Use the Generate button above to create a schedule.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {currentTab === 1 && (
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

                <ScoreModal
                    open={scoreModalOpen}
                    onClose={() => setScoreModalOpen(false)}
                    match={selectedMatch}
                    onSave={handleSaveScore}
                    team1Name={selectedMatch ? getTeamNames(selectedMatch).team1 : ''}
                    team2Name={selectedMatch ? getTeamNames(selectedMatch).team2 : ''}
                />

                <PlaceBetModal
                    open={betModalOpen}
                    onClose={() => setBetModalOpen(false)}
                    match={selectedBetMatch}
                    weekId={sessionId}
                    team1Name={selectedBetMatch ? getTeamNames(selectedBetMatch).team1 : ''}
                    team2Name={selectedBetMatch ? getTeamNames(selectedBetMatch).team2 : ''}
                    userWallet={currentUser ? (currentUser.walletBalance ?? 0) : 0}
                />

                <MatchFrequencyModal
                    open={frequencyModalOpen}
                    onClose={() => setFrequencyModalOpen(false)}
                    members={players}
                    matches={matches}
                />

                <ReviewBetsModal
                    open={reviewBetsModalOpen}
                    onClose={() => setReviewBetsModalOpen(false)}
                    match={selectedReviewMatch}
                    team1Name={selectedReviewMatch ? getTeamNames(selectedReviewMatch).team1 : ''}
                    team2Name={selectedReviewMatch ? getTeamNames(selectedReviewMatch).team2 : ''}
                />

                <SubstitutePlayerModal
                    open={substituteModalOpen}
                    onClose={() => setSubstituteModalOpen(false)}
                    onConfirm={handleSubstitutePlayer}
                    sessionPlayers={players}
                    allPlayers={allAvailablePlayers}
                />
            </div>
        </div>
    );
};

export default SessionDetails;
