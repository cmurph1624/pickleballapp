import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Grid, Button, Chip, CircularProgress, Divider, Paper } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { AttachMoney, CalendarMonth, SportsTennis, EmojiEvents } from '@mui/icons-material';
import Layout from '../components/Layout';

const UserDashboard = () => {
    // User Dashboard Component
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [upcomingWeeks, setUpcomingWeeks] = useState([]);
    const [openBets, setOpenBets] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser) return;

            try {
                // 1. Resolve User -> Player
                const playersRef = collection(db, 'players');
                const qPlayer = query(playersRef, where('linkedUserId', '==', currentUser.uid), limit(1));
                const playerSnap = await getDocs(qPlayer);

                let linkedPlayerId = null;
                if (!playerSnap.empty) {
                    linkedPlayerId = playerSnap.docs[0].id;
                }

                // 2. Fetch Upcoming Weeks
                if (linkedPlayerId) {
                    const weeksRef = collection(db, 'weeks');
                    const qWeeks = query(weeksRef, where('players', 'array-contains', linkedPlayerId));
                    const weeksSnap = await getDocs(qWeeks);

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    const validWeeks = weeksSnap.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(w => {
                            if (!w.scheduledDate) return false;
                            const d = w.scheduledDate.toDate ? w.scheduledDate.toDate() : new Date(w.scheduledDate);
                            return d >= today;
                        })
                        .sort((a, b) => {
                            const dateA = a.scheduledDate.toDate ? a.scheduledDate.toDate() : new Date(a.scheduledDate);
                            const dateB = b.scheduledDate.toDate ? b.scheduledDate.toDate() : new Date(b.scheduledDate);
                            return dateA - dateB;
                        });

                    setUpcomingWeeks(validWeeks);
                }

                // 3. Fetch Open Bets
                const betsRef = collection(db, 'bets');
                const qBets = query(
                    betsRef,
                    where('userId', '==', currentUser.uid),
                    where('status', '==', 'OPEN')
                );
                const betsSnap = await getDocs(qBets);
                const betsData = betsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setOpenBets(betsData);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser]);

    if (loading) {
        return (
            <Layout>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                    <CircularProgress />
                </Box>
            </Layout>
        );
    }

    return (
        <Layout>
            <Box sx={{ width: '100%' }}>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom>
                        Welcome Back, {currentUser.displayName || currentUser.email.split('@')[0]}!
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Here is what's happening in your league careers.
                    </Typography>
                </Box>

                <Grid container spacing={3}>
                    {/* Left Column: Upcoming Schedule (66%) */}
                    <Grid item xs={12} md={8}>
                        <Card sx={{ height: '100%' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                                    <SportsTennis color="primary" />
                                    <Typography variant="h6">Upcoming Schedule</Typography>
                                </Box>

                                {upcomingWeeks.length > 0 ? (
                                    <Grid container spacing={2}>
                                        {upcomingWeeks.map((week) => (
                                            <Grid item xs={12} lg={6} key={week.id}>
                                                <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
                                                    <Box>
                                                        <Typography variant="h6" color="primary">
                                                            {week.name}
                                                        </Typography>
                                                        <Chip
                                                            icon={<CalendarMonth />}
                                                            label={week.scheduledDate?.toDate ? week.scheduledDate.toDate().toLocaleDateString() : new Date(week.scheduledDate).toLocaleDateString()}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{ mt: 0.5 }}
                                                        />
                                                    </Box>
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        onClick={() => navigate(`/clubs/${week.clubId || 'unknown'}/leagues/${week.leagueId}/weeks/${week.id}`)}
                                                    >
                                                        View
                                                    </Button>
                                                </Paper>
                                            </Grid>
                                        ))}
                                    </Grid>
                                ) : (
                                    <Typography color="text.secondary">
                                        No upcoming weeks found. You're all caught up!
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Right Column: Wallet & Bets (33%) */}
                    <Grid item xs={12} md={4}>
                        <Grid container spacing={3} direction="column">
                            {/* Wallet Balance Card - Top */}
                            <Grid item xs={12}>
                                <Card sx={{ background: 'linear-gradient(135deg, #1e88e5 0%, #1565c0 100%)', color: 'white' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                            <AttachMoney fontSize="large" sx={{ opacity: 0.8 }} />
                                            <Typography variant="h6" sx={{ opacity: 0.9 }}>Wallet Balance</Typography>
                                        </Box>
                                        <Typography variant="h3" fontWeight="bold">
                                            ${currentUser.walletBalance || 0}
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.7, mt: 1, display: 'block' }}>
                                            Available for betting
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>

                            {/* Active Bets Section - Bottom */}
                            <Grid item xs={12}>
                                <Card sx={{ height: '100%' }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                                            <EmojiEvents color="warning" />
                                            <Typography variant="h6">Active Bets ({openBets.length})</Typography>
                                        </Box>

                                        {openBets.length > 0 ? (
                                            <Grid container spacing={2}>
                                                {openBets.map(bet => (
                                                    <Grid item xs={12} key={bet.id}>
                                                        <Paper variant="outlined" sx={{ p: 2 }}>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                                <Typography variant="subtitle2" color="text.secondary">
                                                                    Spread: {bet.spreadAtTimeOfBet}
                                                                </Typography>
                                                                <Chip label="OPEN" size="small" color="primary" variant="outlined" />
                                                            </Box>
                                                            <Typography variant="h6" gutterBottom>
                                                                ${bet.amount} on Team {bet.teamPicked}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Potential Payout: ${(bet.amount * 2)}
                                                            </Typography>
                                                        </Paper>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        ) : (
                                            <Typography color="text.secondary">
                                                You have no active bets. Go to the High Rollers page or a Week to place one!
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            </Box>
        </Layout>
    );
};

export default UserDashboard;
