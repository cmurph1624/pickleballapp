import React, { useState, useEffect } from 'react';
import { Typography, Box, IconButton, Fab, TextField, Grid, Card, CardContent, CardActions, Avatar, Chip, Button } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, RestartAlt as ResetIcon, PersonAdd } from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import PlayerModal from '../components/PlayerModal';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { useNavigate } from 'react-router-dom';

const Players = () => {
    const [players, setPlayers] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { isAdmin } = useClub();

    useEffect(() => {
        const q = query(collection(db, 'players'), orderBy('firstName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const playersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPlayers(playersData);
        });

        return () => unsubscribe();
    }, []);

    const handleAdd = () => {
        setSelectedPlayer(null);
        setModalOpen(true);
    };

    const handleEdit = (player) => {
        setSelectedPlayer(player);
        setModalOpen(true);
    };

    const handleDelete = async (player) => {
        if (window.confirm(`Delete ${player.firstName}?`)) {
            try {
                await deleteDoc(doc(db, 'players', player.id));
            } catch (error) {
                console.error("Error deleting player:", error);
                alert("Error deleting player: " + error.message);
            }
        }
    };

    const handleResetRatings = async () => {
        if (window.confirm("Are you sure you want to reset ALL player ratings based on their DUPR? This cannot be undone.")) {
            try {
                const querySnapshot = await getDocs(collection(db, "players"));
                const updates = [];
                querySnapshot.forEach((docSnap) => {
                    const data = docSnap.data();
                    const dupr = data.duprDoubles || 3.5;
                    const newRating = dupr * 10;
                    updates.push(updateDoc(doc(db, "players", docSnap.id), { hiddenRating: newRating }));
                });
                await Promise.all(updates);
                alert(`Successfully reset ratings for ${updates.length} players.`);
            } catch (error) {
                console.error("Error resetting ratings:", error);
                alert("Error resetting ratings: " + error.message);
            }
        }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedPlayer(null);
    };

    const filteredPlayers = players.filter(player => {
        const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Players</Typography>

            <TextField
                label="Search Players"
                variant="outlined"
                fullWidth
                margin="normal"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by first or last name..."
                sx={{ mb: 2 }}
            />

            <Grid container spacing={2}>
                {filteredPlayers.map((player) => (
                    <Grid item xs={12} sm={6} md={4} key={player.id}>
                        <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                            <CardContent sx={{ flexGrow: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                                        {player.firstName[0]}{player.lastName[0]}
                                    </Avatar>
                                    <Box>
                                        <Typography variant="h6" component="div">
                                            {player.firstName} {player.lastName}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {player.gender}
                                        </Typography>
                                    </Box>
                                </Box>

                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    <Chip
                                        label={`DUPR (D): ${player.duprDoubles || 'N/A'}`}
                                        size="small"
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={`DUPR (S): ${player.duprSingles || 'N/A'}`}
                                        size="small"
                                        variant="outlined"
                                    />
                                </Box>
                            </CardContent>

                            {isAdmin && (
                                <CardActions sx={{ justifyContent: 'flex-end' }}>
                                    <IconButton onClick={() => handleEdit(player)} color="primary" size="small">
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton onClick={() => handleDelete(player)} color="error" size="small">
                                        <DeleteIcon />
                                    </IconButton>
                                </CardActions>
                            )}
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {isAdmin && (
                <Fab
                    color="primary"
                    aria-label="add"
                    sx={{ position: 'fixed', bottom: 80, right: 16 }}
                    onClick={handleAdd}
                >
                    <AddIcon />
                </Fab>
            )}

            {isAdmin && (
                <Fab
                    color="secondary"
                    aria-label="reset"
                    sx={{ position: 'fixed', bottom: 80, right: 90 }}
                    onClick={handleResetRatings}
                >
                    <ResetIcon />
                </Fab>
            )}

            {isAdmin && (
                <Button
                    variant="contained"
                    startIcon={<PersonAdd />}
                    onClick={() => navigate('../invite')}
                    sx={{ position: 'fixed', top: 80, right: 16, zIndex: 1000 }}
                >
                    Invite New Player
                </Button>
            )}

            <PlayerModal
                open={modalOpen}
                onClose={handleCloseModal}
                player={selectedPlayer}
            />
        </Box>
    );
};

export default Players;
