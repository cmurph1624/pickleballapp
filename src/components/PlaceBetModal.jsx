import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, TextField, RadioGroup, FormControlLabel, Radio, Alert } from '@mui/material';
import { collection, doc, runTransaction, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

const PlaceBetModal = ({ open, onClose, match, weekId, team1Name, team2Name, userWallet }) => {
    const [teamPicked, setTeamPicked] = useState('1');
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const [existingBet, setExistingBet] = useState(null);
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        const fetchExistingBet = async () => {
            if (open && match && auth.currentUser) {
                setLoading(true);
                setAmount('');
                setTeamPicked('1');
                setError('');
                setExistingBet(null);

                try {
                    const q = query(
                        collection(db, 'bets'),
                        where('userId', '==', auth.currentUser.uid),
                        where('matchId', '==', match.id)
                    );
                    const querySnapshot = await getDocs(q);
                    if (!querySnapshot.empty) {
                        // Assuming one bet per match for now
                        const betData = querySnapshot.docs[0].data();
                        setExistingBet(betData);
                    }
                } catch (err) {
                    console.error("Error fetching existing bet:", err);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchExistingBet();
    }, [open, match]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const betAmount = parseInt(amount);

        if (isNaN(betAmount) || betAmount <= 0) {
            setError("Please enter a valid amount.");
            return;
        }

        // Optimistic check (transaction will verify again)
        if (betAmount > userWallet) {
            setError("Insufficient funds.");
            return;
        }

        try {
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', auth.currentUser.uid);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists()) {
                    throw "User not found";
                }

                const currentBalance = userDoc.data().walletBalance || 0;
                if (betAmount > currentBalance) {
                    throw "Insufficient funds";
                }

                const newBalance = currentBalance - betAmount;
                transaction.update(userRef, { walletBalance: newBalance });

                const newBetRef = doc(collection(db, 'bets'));
                transaction.set(newBetRef, {
                    userId: auth.currentUser.uid,
                    weekId: weekId,
                    matchId: match.id || `match_${Date.now()}`,
                    teamPicked: parseInt(teamPicked),
                    amount: betAmount,
                    spreadAtTimeOfBet: match.spread,
                    favoriteTeamAtTimeOfBet: match.favoriteTeam,
                    status: 'OPEN',
                    createdAt: new Date()
                });
            });

            onClose();
        } catch (err) {
            console.error("Error placing bet:", err);
            setError(typeof err === 'string' ? err : "Failed to place bet.");
        }
    };

    if (!match) return null;

    const spreadText = (team) => {
        if (match.spread === 0) return "Pick 'em (0)";
        if (match.favoriteTeam === team) return `-${match.spread}`;
        return `+${match.spread}`;
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Place Bet</DialogTitle>

            {loading ? (
                <DialogContent><Typography>Loading...</Typography></DialogContent>
            ) : existingBet ? (
                <DialogContent>
                    <Alert severity="info" sx={{ mb: 2 }}>
                        You have already placed a bet on this match.
                    </Alert>
                    <Box sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #ddd' }}>
                        <Typography variant="subtitle2" color="text.secondary">Your Pick</Typography>
                        <Typography variant="h6" gutterBottom>
                            {existingBet.teamPicked === 1 ? team1Name : team2Name}
                        </Typography>

                        <Typography variant="subtitle2" color="text.secondary">Wager</Typography>
                        <Typography variant="h6" color="primary.main">
                            ${existingBet.amount}
                        </Typography>

                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                            Spread at time of bet: {existingBet.spreadAtTimeOfBet === 0 ? "Pick 'em" : existingBet.spreadAtTimeOfBet}
                        </Typography>
                    </Box>
                </DialogContent>
            ) : (
                <form onSubmit={handleSubmit}>
                    <DialogContent>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" gutterBottom>Matchup</Typography>
                            <Typography variant="body1">{team1Name} vs {team2Name}</Typography>
                        </Box>

                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle1" gutterBottom>Select Winner (with Spread)</Typography>
                            <RadioGroup
                                value={teamPicked}
                                onChange={(e) => setTeamPicked(e.target.value)}
                            >
                                <FormControlLabel
                                    value="1"
                                    control={<Radio />}
                                    label={`${team1Name} (${spreadText(1)})`}
                                />
                                <FormControlLabel
                                    value="2"
                                    control={<Radio />}
                                    label={`${team2Name} (${spreadText(2)})`}
                                />
                            </RadioGroup>
                        </Box>

                        <TextField
                            label={`Wager Amount (Balance: $${userWallet})`}
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            fullWidth
                            required
                            inputProps={{ min: 1, max: userWallet }}
                        />

                        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onClose}>Cancel</Button>
                        <Button type="submit" variant="contained" color="primary">Place Bet</Button>
                    </DialogActions>
                </form>
            )}

            {existingBet && (
                <DialogActions>
                    <Button onClick={onClose}>Close</Button>
                </DialogActions>
            )}
        </Dialog>
    );
};

export default PlaceBetModal;
