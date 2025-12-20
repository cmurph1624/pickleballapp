import React, { useState, useEffect } from 'react';
import { Typography, Box, Button, Paper, Grid, IconButton, List, ListItem, ListItemText } from '@mui/material';
import { ArrowBack, Refresh, Delete } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { generateMatches } from '../utils/matchGenerator';
import { calculateSpread } from '../services/Oddsmaker';
import { updateRatings } from '../services/RatingEngine';
import { resolveBetsForMatch } from '../services/BettingService';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';

import ScoreModal from '../components/ScoreModal';
import PlaceBetModal from '../components/PlaceBetModal';

const WeekDetails = () => {
    const { currentUser } = useAuth();
    const { isAdmin, clubId } = useClub(); // Use Club Permission and ID
    const { leagueId, weekId } = useParams();
    const navigate = useNavigate();
    const [week, setWeek] = useState(null);
    const [players, setPlayers] = useState([]);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);

    // Score Modal State
    const [scoreModalOpen, setScoreModalOpen] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState(null);

    // Betting Modal State
    const [betModalOpen, setBetModalOpen] = useState(false);
    const [selectedBetMatch, setSelectedBetMatch] = useState(null);

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
                    // Firestore 'in' query supports max 10 items. We might have more.
                    // Better to fetch all players and filter in memory for now, or batch queries.
                    // Given the previous pattern, let's fetch all and filter.
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

        const gamesPerPlayer = week.gamesPerPlayer || 4; // Default to 4 if not set
        let newMatches = generateMatches(players, gamesPerPlayer);

        // Calculate Spreads for each match
        newMatches = newMatches.map(match => {
            const team1Players = players.filter(p => match.team1.includes(p.id));
            const team2Players = players.filter(p => match.team2.includes(p.id));
            const { spread, favoriteTeam } = calculateSpread(team1Players, team2Players);
            return { ...match, spread, favoriteTeam };
        });

        setMatches(newMatches);

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
        // 1. Update local match state
        const updatedMatches = matches.map(m => {
            if (m.id === matchId) {
                return { ...m, team1Score, team2Score };
            }
            return m;
        });
        setMatches(updatedMatches);

        try {
            // 2. Save Match Score to Firestore
            await updateDoc(doc(db, 'weeks', weekId), {
                matches: updatedMatches
            });

            // 3. Calculate and Update Player Ratings
            const match = matches.find(m => m.id === matchId);
            if (match) {
                const matchWithScore = { ...match, team1Score, team2Score };
                const team1Players = players.filter(p => match.team1.includes(p.id));
                const team2Players = players.filter(p => match.team2.includes(p.id));

                const updatedPlayers = updateRatings(matchWithScore, team1Players, team2Players);

                // 4. Batch Update Players in Firestore
                const updates = updatedPlayers.map(p =>
                    updateDoc(doc(db, 'players', p.id), { hiddenRating: p.hiddenRating })
                );
                await Promise.all(updates);
                console.log("Updated ratings for", updatedPlayers.length, "players");

                // 5. Update local players state to reflect new ratings immediately
                setPlayers(prevPlayers => prevPlayers.map(p => {
                    const updated = updatedPlayers.find(up => up.id === p.id);
                    return updated ? updated : p;
                }));

                // 6. Resolve Bets
                await resolveBetsForMatch(matchId, team1Score, team2Score, matchWithScore);
            }

        } catch (error) {
            console.error("Error saving score:", error);
            alert("Error saving score: " + error.message);
        }
    };

    const getPlayerName = (id) => {
        const p = players.find(player => player.id === id);
        return p ? `${p.firstName} ${p.lastName}` : 'Unknown';
    };

    const getTeamNames = (match) => {
        if (!match) return { team1: '', team2: '' };
        const t1 = `${getPlayerName(match.team1[0])} & ${getPlayerName(match.team1[1])}`;
        const t2 = `${getPlayerName(match.team2[0])} & ${getPlayerName(match.team2[1])}`;
        return { team1: t1, team2: t2 };
    };

    if (loading) return <Typography>Loading...</Typography>;
    if (!week) return <Typography>Week not found</Typography>;

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <IconButton onClick={() => navigate(`/clubs/${clubId}/leagues/${leagueId}`)} sx={{ mr: 1 }}>
                    <ArrowBack />
                </IconButton>
                <Typography variant="h4">{week.name}</Typography>
            </Box>

            <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1">
                    Players: {players.length} | Target Rounds: {week.gamesPerPlayer || 'N/A'}
                </Typography>
            </Box>

            {isAdmin && (
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <Button
                        variant="contained"
                        startIcon={<Refresh />}
                        onClick={handleGenerateMatches}
                        disabled={matches.some(m => m.team1Score !== undefined || m.team2Score !== undefined)}
                    >
                        Generate Matches
                    </Button>
                    {matches.length > 0 && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<Delete />}
                            onClick={handleClearMatches}
                            disabled={matches.some(m => m.team1Score !== undefined || m.team2Score !== undefined)}
                        >
                            Clear Matches
                        </Button>
                    )}
                </Box>
            )}

            <Typography variant="h5" gutterBottom>Matches ({matches.length})</Typography>

            <Box>
                {(() => {
                    const matchesPerRound = Math.floor(players.length / 4);
                    // If matchesPerRound is 0 (e.g. < 4 players), fallback to 1 to show something, though generator shouldn't run.
                    const chunkSize = matchesPerRound > 0 ? matchesPerRound : 1;

                    const rounds = [];
                    for (let i = 0; i < matches.length; i += chunkSize) {
                        rounds.push(matches.slice(i, i + chunkSize));
                    }

                    return rounds.map((roundMatches, roundIndex) => (
                        <Box key={roundIndex} sx={{ mb: 4 }}>
                            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', borderBottom: 1, borderColor: 'divider', pb: 1 }}>
                                Round {roundIndex + 1}
                            </Typography>
                            <Grid container spacing={2}>
                                {roundMatches.map((match, matchIndex) => (
                                    <Grid item xs={12} md={6} key={match.id || matchIndex}>
                                        <Paper
                                            sx={{
                                                p: 2,
                                                cursor: 'pointer',
                                                '&:hover': { bgcolor: 'action.hover' },
                                                transition: 'background-color 0.2s'
                                            }}
                                            onClick={() => handleMatchClick(match)}
                                        >
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                <Box>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        Match {matchIndex + 1}
                                                    </Typography>
                                                    {match.spread !== undefined && (
                                                        <Typography variant="caption" color="primary" sx={{ fontWeight: 'bold' }}>
                                                            {match.spread === 0 ? "Pick 'em (0)" :
                                                                match.favoriteTeam === 1 ? `Team 1 (-${match.spread})` :
                                                                    match.favoriteTeam === 2 ? `Team 2 (-${match.spread})` : ''}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                {(match.team1Score !== undefined && match.team2Score !== undefined) ? (
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                                        Score: {match.team1Score} - {match.team2Score}
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                                                        Click to score
                                                    </Typography>
                                                )}
                                            </Box>

                                            <Grid container alignItems="center">
                                                <Grid item xs={5}>
                                                    <Box sx={{ textAlign: 'center' }}>
                                                        <Typography variant="body1" fontWeight="bold">{getPlayerName(match.team1[0])}</Typography>
                                                        <Typography variant="body1" fontWeight="bold">{getPlayerName(match.team1[1])}</Typography>
                                                    </Box>
                                                </Grid>
                                                <Grid item xs={2} sx={{ textAlign: 'center' }}>
                                                    <Typography variant="h6" color="text.secondary">VS</Typography>
                                                </Grid>
                                                <Grid item xs={5}>
                                                    <Box sx={{ textAlign: 'center' }}>
                                                        <Typography variant="body1" fontWeight="bold">{getPlayerName(match.team2[0])}</Typography>
                                                        <Typography variant="body1" fontWeight="bold">{getPlayerName(match.team2[1])}</Typography>
                                                    </Box>
                                                </Grid>
                                            </Grid>

                                            {/* Betting Button */}
                                            {week.bettingDeadline && new Date() < new Date(week.bettingDeadline) && match.team1Score === undefined && (
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    fullWidth
                                                    sx={{ mt: 2 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleBetClick(match);
                                                    }}
                                                >
                                                    Place Bet
                                                </Button>
                                            )}
                                        </Paper>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    ));
                })()}
            </Box>

            {matches.length === 0 && (
                <Typography color="text.secondary">No matches generated yet.</Typography>
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
                weekId={weekId}
                team1Name={selectedBetMatch ? getTeamNames(selectedBetMatch).team1 : ''}
                team2Name={selectedBetMatch ? getTeamNames(selectedBetMatch).team2 : ''}
                userWallet={currentUser ? (currentUser.walletBalance || 1000) : 0}
            />
        </Box>
    );
};

export default WeekDetails;
