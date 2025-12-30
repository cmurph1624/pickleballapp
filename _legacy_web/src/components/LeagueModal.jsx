import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box, FormControlLabel, Checkbox, Typography, Alert } from '@mui/material';
import { collection, addDoc, doc, updateDoc, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useClub } from '../contexts/ClubContext';

const LeagueModal = ({ open, onClose, league }) => {
    const { clubId } = useClub();
    const [formData, setFormData] = useState({
        name: '',
        startDate: '',
        endDate: '',
        type: 'Cumulative',
        players: []
    });
    const [allPlayers, setAllPlayers] = useState([]);
    const [errors, setErrors] = useState({});

    // Fetch players for selection
    useEffect(() => {
        const q = query(collection(db, 'players'), orderBy('firstName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const playersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAllPlayers(playersData);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (league) {
            setFormData({
                name: league.name,
                startDate: league.startDate,
                endDate: league.endDate,
                type: league.type,
                players: league.players || []
            });
        } else {
            setFormData({
                name: '',
                startDate: '',
                endDate: '',
                type: 'Cumulative',
                players: []
            });
        }
        setErrors({});
    }, [league, open]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        // If switching to Open Play, clear players
        if (name === 'type' && value === 'Open Play') {
            setFormData(prev => ({ ...prev, [name]: value, players: [] }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }

        // Clear errors on change
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
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

    const validate = async () => {
        const newErrors = {};

        // Date Validation
        if (formData.startDate && formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
            newErrors.date = "End date cannot be before start date.";
        }

        // Name Uniqueness
        if (formData.name.trim()) {
            // Only check if name changed (for edit)
            if (!league || league.name !== formData.name.trim()) {
                const q = query(collection(db, 'leagues'), where("name", "==", formData.name.trim()));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    newErrors.name = "League name already exists.";
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const isValid = await validate();
        if (!isValid) return;

        const data = {
            clubId: clubId, // Associate with current club
            name: formData.name,
            startDate: formData.startDate,
            endDate: formData.endDate,
            type: formData.type,
            players: formData.players,
            updatedAt: new Date()
        };

        try {
            if (league) {
                await updateDoc(doc(db, 'leagues', league.id), data);
            } else {
                data.createdAt = new Date();
                data.createdBy = auth.currentUser ? auth.currentUser.uid : 'anonymous';
                await addDoc(collection(db, 'leagues'), data);
            }
            onClose();
        } catch (error) {
            console.error("Error saving league:", error);
            alert("Error saving league: " + error.message);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{league ? 'Edit League' : 'Create League'}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="League Name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            fullWidth
                            error={!!errors.name}
                            helperText={errors.name}
                        />
                        <TextField
                            label="Start Date"
                            name="startDate"
                            type="date"
                            value={formData.startDate}
                            onChange={handleChange}
                            required
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                        />
                        <TextField
                            label="End Date"
                            name="endDate"
                            type="date"
                            value={formData.endDate}
                            onChange={handleChange}
                            required
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            error={!!errors.date}
                            helperText={errors.date}
                        />
                        <TextField
                            select
                            label="Type"
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            required
                            fullWidth
                        >
                            <MenuItem value="Cumulative">Cumulative</MenuItem>
                            <MenuItem value="Open Play">Open Play</MenuItem>
                        </TextField>

                        {formData.type !== 'Open Play' && (
                            <Box>
                                <Typography variant="subtitle1" gutterBottom>Select Players</Typography>
                                <Box sx={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 1, p: 1 }}>
                                    {allPlayers.map(player => (
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
                                    {allPlayers.length === 0 && <Typography color="text.secondary">No players available.</Typography>}
                                </Box>
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose} color="inherit">Cancel</Button>
                    <Button type="submit" variant="contained" disabled={Object.keys(errors).length > 0}>Save</Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default LeagueModal;
