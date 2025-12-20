import React, { useState, useEffect } from 'react';
import { Typography, Box, List, ListItem, ListItemText, IconButton, Fab, Paper, Button, ListItemButton, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, ArrowBack } from '@mui/icons-material';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import WeekModal from '../components/WeekModal';
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
    const [weeks, setWeeks] = useState([]);
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [weekModalOpen, setWeekModalOpen] = useState(false);
    const [leagueModalOpen, setLeagueModalOpen] = useState(false);
    const [selectedWeek, setSelectedWeek] = useState(null);

    // Tab State
    const [currentTab, setCurrentTab] = useState(0);
    const [standings, setStandings] = useState([]);

    // If Open Play, default to Weeks tab (1)
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

    // Fetch Weeks and Calculate Standings
    useEffect(() => {
        const q = query(collection(db, 'weeks'), where('leagueId', '==', id));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const weeksData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort weeks by name or creation date if possible. 
            // For now, simple sort.
            weeksData.sort((a, b) => a.name.localeCompare(b.name));
            setWeeks(weeksData);
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

    // Recalculate Standings whenever Weeks or Players change
    useEffect(() => {
        if (league && league.type === 'Open Play') {
            setStandings([]);
            return;
        }
        if (players.length > 0 && weeks.length > 0) {
            const newStandings = calculateStandings(players, weeks);
            setStandings(newStandings);
        }
    }, [players, weeks, league]);

    const handleDelete = async (week) => {
        if (window.confirm(`Are you sure you want to delete ${week.name}?`)) {
            try {
                await deleteDoc(doc(db, 'weeks', week.id));
            } catch (error) {
                console.error("Error deleting week:", error);
            }
        }
    };

    const handleEdit = (week) => {
        setSelectedWeek(week);
        setWeekModalOpen(true);
    };

    const handleAddWeek = () => {
        setSelectedWeek(null);
        setWeekModalOpen(true);
    };

    const handleEditLeague = () => {
        setLeagueModalOpen(true);
    }

    if (loading) return <Typography>Loading...</Typography>;
    if (!league) return <Typography>League not found</Typography>;

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={() => navigate(`/clubs/${clubId}/leagues`)} sx={{ mr: 1 }}>
                        <ArrowBack />
                    </IconButton>
                    <Typography variant="h4">{league.name}</Typography>
                </Box>
                {isAdmin && (
                    <Button startIcon={<EditIcon />} onClick={handleEditLeague}>
                        Edit League
                    </Button>
                )}
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={currentTab} onChange={(e, val) => setCurrentTab(val)}>
                    {league.type !== 'Open Play' && <Tab label="Standings" />}
                    <Tab label="Weeks" />
                </Tabs>
            </Box>

            {currentTab === 0 && league.type !== 'Open Play' && (
                <TableContainer component={Paper}>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Rank</TableCell>
                                <TableCell>Player</TableCell>
                                <TableCell align="right">Wins</TableCell>
                                <TableCell align="right">Losses</TableCell>
                                <TableCell align="right">PF</TableCell>
                                <TableCell align="right">PA</TableCell>
                                <TableCell align="right">Diff</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {standings.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell component="th" scope="row">
                                        {row.rank}
                                    </TableCell>
                                    <TableCell>{row.name}</TableCell>
                                    <TableCell align="right">{row.wins}</TableCell>
                                    <TableCell align="right">{row.losses}</TableCell>
                                    <TableCell align="right">{row.pointsFor}</TableCell>
                                    <TableCell align="right">{row.pointsAgainst}</TableCell>
                                    <TableCell align="right" sx={{
                                        color: row.diff > 0 ? 'success.main' : row.diff < 0 ? 'error.main' : 'text.primary',
                                        fontWeight: 'bold'
                                    }}>
                                        {row.diff > 0 ? `+${row.diff}` : row.diff}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {currentTab === 1 && (
                <>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Weeks</Typography>
                        {isAdmin && (
                            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddWeek}>
                                Add Week
                            </Button>
                        )}
                    </Box>

                    <List>
                        {weeks.map((week) => (
                            <Paper key={week.id} sx={{ mb: 2 }}>
                                <ListItem
                                    secondaryAction={
                                        isAdmin && (
                                            <Box>
                                                <IconButton onClick={() => handleEdit(week)} color="primary">
                                                    <EditIcon />
                                                </IconButton>
                                                <IconButton onClick={() => handleDelete(week)} color="error">
                                                    <DeleteIcon />
                                                </IconButton>
                                            </Box>
                                        )
                                    }
                                >
                                    <ListItemButton onClick={() => navigate(`/clubs/${clubId}/leagues/${id}/weeks/${week.id}`)}>
                                        <ListItemText
                                            primary={week.name}
                                            secondary={
                                                <>
                                                    <Typography variant="body2" component="span" display="block">
                                                        {week.gamesPerPlayer ? `${week.gamesPerPlayer} Rounds` : 'Rounds not set'}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {week.players ? week.players.length : 0} Players
                                                    </Typography>
                                                </>
                                            }
                                        />
                                    </ListItemButton>
                                </ListItem>
                            </Paper>
                        ))}
                    </List>
                    {weeks.length === 0 && <Typography color="text.secondary">No weeks found. Add one to get started.</Typography>}
                </>
            )}

            <WeekModal
                open={weekModalOpen}
                onClose={() => setWeekModalOpen(false)}
                week={selectedWeek}
                league={league}
            />

            <LeagueModal
                open={leagueModalOpen}
                onClose={() => setLeagueModalOpen(false)}
                league={league}
            />
        </Box>
    );
};

export default LeagueDetails;
