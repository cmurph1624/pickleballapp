import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { generateMatches } from '../utils/matchGenerator';
import { calculateSpread } from '../services/Oddsmaker';
import { validateSchedule } from '../utils/scheduleValidator';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { completeWeek } from '../services/WeekService';

import ScoreModal from '../components/ScoreModal';
import PlaceBetModal from '../components/PlaceBetModal';
import MatchFrequencyModal from '../components/MatchFrequencyModal';
import WeekScorecard from '../components/WeekScorecard';

const WeekDetails = () => {
    const { currentUser } = useAuth();
    const { isAdmin, clubId } = useClub();
    const { leagueId, weekId } = useParams();
    const navigate = useNavigate();
    const [week, setWeek] = useState(null);
    const [players, setPlayers] = useState([]);
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Week
                const weekDoc = await getDoc(doc(db, 'weeks', weekId));
                if (!weekDoc.exists()) {
                    navigate('/');
                    return;
                }
                const weekData = { id: weekDoc.id, ...weekDoc.data() };
                setWeek(weekData);
                setMatches(weekData.matches || []);

                // Fetch Players
                if (weekData.players && weekData.players.length > 0) {
                    const playersQuery = query(collection(db, 'players'));
                    const playersSnap = await getDocs(playersQuery);
                    const allPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    const weekPlayers = allPlayers.filter(p => weekData.players.includes(p.id));
                    setPlayers(weekPlayers);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [weekId, navigate]);

    const handleGenerateMatches = async () => {
        if (!week || !players.length) return;

        const gamesPerPlayer = week.gamesPerPlayer || 4;
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
            await updateDoc(doc(db, 'weeks', weekId), {
                matches: newMatches
            });
        } catch (error) {
            console.error("Error saving matches:", error);
            alert("Error saving matches: " + error.message);
        }
    };

    const handleClearMatches = async () => {
        if (window.confirm("Are you sure you want to clear all matches?")) {
            setMatches([]);
            try {
                await updateDoc(doc(db, 'weeks', weekId), {
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

    const handleSaveScore = async (matchId, team1Score, team2Score) => {
        const updatedMatches = matches.map(m => {
            if (m.id === matchId) {
                return { ...m, team1Score, team2Score };
            }
            return m;
        });
        setMatches(updatedMatches);

        try {
            await updateDoc(doc(db, 'weeks', weekId), {
                matches: updatedMatches
            });
        } catch (error) {
            console.error("Error saving score:", error);
            alert("Error saving score: " + error.message);
        }
    };

    const handleCompleteWeek = async () => {
        if (!window.confirm("Are you sure you want to COMPLETE this week? This will update player ratings, resolve bets (and refund unplayed ones), and lock the week.")) {
            return;
        }

        try {
            setLoading(true);
            const updatedPlayers = await completeWeek(weekId);

            setWeek(prev => ({ ...prev, status: 'COMPLETED' }));
            if (updatedPlayers) {
                setPlayers(updatedPlayers);
            }
            alert("Week completed successfully!");

        } catch (error) {
            console.error("Error completing week:", error);
            alert("Error completing week: " + error.message);
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

    if (!week) return <div className="p-4 text-center">Week not found</div>;

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
            #week-content-root {
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
        }
        .print-only {
            display: none;
        }
    `;

    return (
        <div id="week-content-root" className="w-full">
            <style>{printStyles}</style>

            <div className="print-only">
                <WeekScorecard weekName={week.name} matches={matches} players={players} />
            </div>

            <div className="screen-only">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/clubs/${clubId}/leagues/${leagueId}`)}
                            className="p-2 -ml-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors no-print"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                {week.name}
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Players: {players.length} | Target Rounds: {week.gamesPerPlayer || 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Control Bar */}
                {isAdmin && (
                    <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6 flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
                        {week.status === 'COMPLETED' ? (
                            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-lg">
                                <span className="material-symbols-outlined">lock</span>
                                Week Completed
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
                                            disabled={matches.some(m => m.team1Score !== undefined || m.team2Score !== undefined)}
                                            className="bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-lg">autorenew</span>
                                            Generate
                                        </button>
                                        {matches.length > 0 && (
                                            <button
                                                onClick={handleClearMatches}
                                                disabled={matches.some(m => m.team1Score !== undefined || m.team2Score !== undefined)}
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
                                        onClick={handleCompleteWeek}
                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors shadow-sm ml-auto sm:ml-0"
                                    >
                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                        Complete Week
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

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
                                                if (week.status !== 'COMPLETED') {
                                                    handleMatchClick(match);
                                                }
                                            }}
                                            className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl p-4 cursor-pointer hover:border-primary transition-all shadow-sm hover:shadow-md group relative"
                                        >
                                            {/* Header: Label and Spread */}
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                                                        Match {matchIndex + 1}
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
                                            {week.bettingDeadline && new Date() < new Date(week.bettingDeadline) && match.team1Score === undefined && week.status !== 'COMPLETED' && (
                                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleBetClick(match);
                                                        }}
                                                        className="w-full text-center text-xs font-bold text-primary hover:text-primary-dark py-1 rounded hover:bg-primary/5 transition-colors"
                                                    >
                                                        Place Bet
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
                    weekId={weekId}
                    team1Name={selectedBetMatch ? getTeamNames(selectedBetMatch).team1 : ''}
                    team2Name={selectedBetMatch ? getTeamNames(selectedBetMatch).team2 : ''}
                    userWallet={currentUser ? (currentUser.walletBalance || 1000) : 0}
                />

                <MatchFrequencyModal
                    open={frequencyModalOpen}
                    onClose={() => setFrequencyModalOpen(false)}
                    members={players}
                    matches={matches}
                />
            </div>
        </div>
    );
};

export default WeekDetails;
