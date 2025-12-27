import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, FormControlLabel, Checkbox, Typography } from '@mui/material';
import { collection, addDoc, doc, updateDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

const SessionModal = ({ open, onClose, session, league }) => {
    const [formData, setFormData] = useState({
        name: '',
        players: [],
        gamesPerPlayer: '',
        bettingDeadline: '',
        scheduledDate: ''
    });
    const [leaguePlayers, setLeaguePlayers] = useState([]);

    // Fetch all players to map IDs to names, but only show league players
    useEffect(() => {
        if (!league) {
            setLeaguePlayers([]);
            return;
        }

        const q = query(collection(db, 'players'), orderBy('firstName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // If NOT Open Play, filter by league roster
            if (league.type !== 'Open Play') {
                if (!league.players || league.players.length === 0) {
                    playersData = [];
                } else {
                    playersData = playersData.filter(p => league.players.includes(p.id));
                }
            }
            // If Open Play, show all players (already in playersData)

            setLeaguePlayers(playersData);
        });
        return () => unsubscribe();
    }, [league]);

    useEffect(() => {
        if (session) {
            setFormData({
                name: session.name,
                players: session.players || [],
                gamesPerPlayer: session.gamesPerPlayer || '',
                bettingDeadline: session.bettingDeadline || '',
                scheduledDate: session.scheduledDate || ''
            });
        } else {
            setFormData({
                name: '',
                players: [],
                gamesPerPlayer: '',
                bettingDeadline: '',
                scheduledDate: ''
            });
        }
    }, [session, open]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePlayerToggle = (playerId) => {
        setFormData(prev => {
            const currentPlayers = prev.players;
            if (currentPlayers.includes(playerId)) {
                return { ...prev, players: currentPlayers.filter(id => id !== playerId) };
            } else {
                return { ...prev, players: [...currentPlayers, playerId] };
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const data = {
            leagueId: league.id,
            name: formData.name,
            players: formData.players,
            gamesPerPlayer: parseInt(formData.gamesPerPlayer) || 0,
            bettingDeadline: formData.bettingDeadline,
            scheduledDate: formData.scheduledDate,
            updatedAt: new Date()
        };

        try {
            if (session) {
                await updateDoc(doc(db, 'sessions', session.id), data);
            } else {
                data.createdAt = new Date();
                data.createdBy = auth.currentUser ? auth.currentUser.uid : 'anonymous';
                await addDoc(collection(db, 'sessions'), data);
            }
            onClose();
        } catch (error) {
            console.error("Error saving session:", error);
            alert("Error saving session: " + error.message);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{session ? 'Edit Session' : 'Add Session'}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="Session Name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            fullWidth
                            placeholder="e.g. Session 1"
                        />

                        <TextField
                            label="Number of Rounds"
                            name="gamesPerPlayer"
                            type="number"
                            value={formData.gamesPerPlayer}
                            onChange={handleChange}
                            fullWidth
                            inputProps={{ min: 0 }}
                            placeholder="e.g. 4"
                            helperText={
                                formData.players.length < 4
                                    ? "Select at least 4 players"
                                    : formData.players.length === 4
                                        ? "Recommended: 3 rounds (Round Robin)"
                                        : formData.players.length === 5
                                            ? "Recommended: 5 rounds (Everyone sits once)"
                                            : formData.players.length < 9
                                                ? `Recommended: ${formData.players.length % 2 === 0 ? formData.players.length - 1 : formData.players.length} rounds for full rotation`
                                                : "Recommended: 4-6 rounds for a typical session"
                            }
                        />

                        <TextField
                            label="Betting Deadline"
                            name="bettingDeadline"
                            type="datetime-local"
                            value={formData.bettingDeadline}
                            onChange={handleChange}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            helperText="Bets will be locked after this time"
                        />

                        <TextField
                            label="Scheduled Date"
                            name="scheduledDate"
                            type="datetime-local"
                            value={formData.scheduledDate}
                            onChange={handleChange}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            helperText="When this session's games are played"
                        />

                        <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="subtitle1">Select Players</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {formData.players.length} of {leaguePlayers.length} selected
                                </Typography>
                            </Box>
                            <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 1, p: 1 }}>
                                {leaguePlayers.map(player => (
                                    <FormControlLabel
                                        key={player.id}
                                        control={
                                            <Checkbox
                                                checked={formData.players.includes(player.id)}
                                                onChange={() => handlePlayerToggle(player.id)}
                                            />
                                        }
                                        label={`${player.firstName} ${player.lastName}`}
                                        sx={{ display: 'block', m: 0 }}
                                    />
                                ))}
                                {leaguePlayers.length === 0 && <Typography color="text.secondary">No players in this league.</Typography>}
                            </Box>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} color="inherit">Cancel</Button>
                    <Button type="submit" variant="contained">Save</Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default SessionModal;
