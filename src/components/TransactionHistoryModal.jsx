import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, List, ListItem, ListItemText, Divider, Chip } from '@mui/material';
import { collection, query, where, orderBy, getDocs, documentId } from 'firebase/firestore';
import { db } from '../firebase';

const TransactionHistoryModal = ({ open, onClose, userId, userEmail }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (open && userId) {
                setLoading(true);
                setTransactions([]);
                try {
                    // 1. Fetch Bets
                    // 1. Fetch Bets
                    const betsQuery = query(
                        collection(db, 'bets'),
                        where('userId', '==', userId)
                    );
                    const betsSnap = await getDocs(betsQuery);
                    let bets = betsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                    // Sort in memory to avoid needing a composite index
                    bets.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

                    if (bets.length === 0) {
                        setLoading(false);
                        return;
                    }

                    // 2. Fetch Related Weeks (to get League Name and Match Details)
                    const weekIds = [...new Set(bets.map(b => b.weekId))];
                    // Firestore 'in' limit is 10. If > 10, we'd need to batch or fetch individually.
                    // For now, let's fetch individually to be safe and simple given likely scale.
                    // Or fetch all weeks if list is small? Fetching individually is safer for now.

                    const weeksData = {};
                    const playersData = {}; // Cache players if needed, but match usually has names? 
                    // Wait, match in Week doc only has IDs usually. We need player names.
                    // Let's fetch all players once to resolve names.

                    const playersSnap = await getDocs(collection(db, 'players'));
                    const playersMap = {};
                    playersSnap.forEach(doc => {
                        playersMap[doc.id] = `${doc.data().firstName} ${doc.data().lastName}`;
                    });

                    // Fetch Weeks
                    for (const wId of weekIds) {
                        // We could use getDoc here
                        // Optimization: Promise.all
                    }
                    // Let's use Promise.all for weeks
                    const weekDocs = await Promise.all(weekIds.map(id => getDocs(query(collection(db, 'weeks'), where(documentId(), '==', id)))));

                    weekDocs.forEach(snap => {
                        if (!snap.empty) {
                            const doc = snap.docs[0];
                            weeksData[doc.id] = doc.data();
                        }
                    });

                    // 3. Assemble Data
                    const history = bets.map(bet => {
                        const week = weeksData[bet.weekId];
                        const match = week?.matches?.find(m => m.id === bet.matchId);

                        let matchDesc = "Unknown Match";
                        if (match) {
                            const t1 = `${playersMap[match.team1[0]] || '?'} & ${playersMap[match.team1[1]] || '?'}`;
                            const t2 = `${playersMap[match.team2[0]] || '?'} & ${playersMap[match.team2[1]] || '?'}`;
                            matchDesc = `${t1} vs ${t2}`;
                        }

                        // Determine P&L display
                        let pnl = 0;
                        let pnlColor = 'text.secondary';

                        if (bet.status === 'WON') {
                            pnl = bet.amount; // Profit is equal to amount (1:1)
                            pnlColor = 'success.main';
                        } else if (bet.status === 'LOST') {
                            pnl = -bet.amount;
                            pnlColor = 'error.main';
                        } else if (bet.status === 'PUSH') {
                            pnl = 0;
                            pnlColor = 'warning.main';
                        }

                        return {
                            ...bet,
                            leagueName: week?.name || 'Unknown Week', // Week name usually acts as context
                            matchDesc,
                            pnl,
                            pnlColor
                        };
                    });

                    setTransactions(history);

                } catch (error) {
                    console.error("Error fetching history:", error);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchHistory();
    }, [open, userId]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Transaction History: {userEmail}</DialogTitle>
            <DialogContent>
                {loading ? (
                    <Typography>Loading history...</Typography>
                ) : transactions.length === 0 ? (
                    <Typography>No betting history found.</Typography>
                ) : (
                    <List>
                        {transactions.map((tx, index) => (
                            <React.Fragment key={tx.id}>
                                <ListItem alignItems="flex-start">
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle1" fontWeight="bold">
                                                    {tx.leagueName}
                                                </Typography>
                                                <Typography variant="subtitle1" fontWeight="bold" color={tx.pnlColor}>
                                                    {tx.status === 'OPEN' ? 'PENDING' :
                                                        tx.pnl > 0 ? `+$${tx.pnl}` :
                                                            tx.pnl < 0 ? `-$${Math.abs(tx.pnl)}` : `$0`}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={
                                            <Box component="span">
                                                <Typography variant="body2" color="text.primary" display="block">
                                                    {tx.matchDesc}
                                                </Typography>
                                                <Typography variant="body2" display="block">
                                                    Pick: {tx.teamPicked === 1 ? 'Team 1' : 'Team 2'}
                                                    {tx.spreadAtTimeOfBet !== 0 && ` (${tx.teamPicked === tx.favoriteTeamAtTimeOfBet ? '-' : '+'}${tx.spreadAtTimeOfBet})`}
                                                    {' '}| Wager: ${tx.amount}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(tx.createdAt.seconds * 1000).toLocaleDateString()}
                                                </Typography>
                                                <Chip
                                                    label={tx.status}
                                                    size="small"
                                                    color={tx.status === 'WON' ? 'success' : tx.status === 'LOST' ? 'error' : tx.status === 'OPEN' ? 'default' : 'warning'}
                                                    sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                                />
                                            </Box>
                                        }
                                    />
                                </ListItem>
                                {index < transactions.length - 1 && <Divider component="li" />}
                            </React.Fragment>
                        ))}
                    </List>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
};

export default TransactionHistoryModal;
