import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography } from '@mui/material';

const ScoreModal = ({ open, onClose, match, onSave, team1Name, team2Name }) => {
    const [team1Score, setTeam1Score] = useState('');
    const [team2Score, setTeam2Score] = useState('');

    useEffect(() => {
        if (match) {
            setTeam1Score(match.team1Score !== undefined ? match.team1Score : '');
            setTeam2Score(match.team2Score !== undefined ? match.team2Score : '');
        } else {
            setTeam1Score('');
            setTeam2Score('');
        }
    }, [match, open]);

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(match.id, parseInt(team1Score) || 0, parseInt(team2Score) || 0);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Enter Score</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1" sx={{ width: '60%' }}>{team1Name}</Typography>
                            <TextField
                                type="number"
                                label="Score"
                                value={team1Score}
                                onChange={(e) => setTeam1Score(e.target.value)}
                                sx={{ width: '35%' }}
                                inputProps={{ min: 0 }}
                                autoFocus
                            />
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle1" sx={{ width: '60%' }}>{team2Name}</Typography>
                            <TextField
                                type="number"
                                label="Score"
                                value={team2Score}
                                onChange={(e) => setTeam2Score(e.target.value)}
                                sx={{ width: '35%' }}
                                inputProps={{ min: 0 }}
                            />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="contained">Save</Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default ScoreModal;
