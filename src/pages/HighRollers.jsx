import React, { useState, useEffect } from 'react';
import { Typography, Box, Paper, List, ListItem, ListItemText, ListItemAvatar, Avatar, Divider } from '@mui/material';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { EmojiEvents } from '@mui/icons-material';
import TransactionHistoryModal from '../components/TransactionHistoryModal';

const HighRollers = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);

    useEffect(() => {
        const fetchHighRollers = async () => {
            try {
                const q = query(collection(db, 'users'), orderBy('walletBalance', 'desc'), limit(20));
                const snapshot = await getDocs(q);
                const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUsers(usersData);
            } catch (error) {
                console.error("Error fetching high rollers:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHighRollers();
    }, []);

    const handleUserClick = (user) => {
        setSelectedUser(user);
        setHistoryModalOpen(true);
    };

    if (loading) return <Typography>Loading Leaderboard...</Typography>;

    return (
        <Box>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EmojiEvents color="warning" fontSize="large" />
                High Rollers
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" gutterBottom>
                The wealthiest players in the league. Click on a player to view their history.
            </Typography>

            <Paper sx={{ mt: 3 }}>
                <List>
                    {users.map((user, index) => (
                        <React.Fragment key={user.id}>
                            <ListItem
                                button
                                onClick={() => handleUserClick(user)}
                                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                            >
                                <ListItemAvatar>
                                    <Avatar sx={{ bgcolor: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'primary.main' }}>
                                        {index + 1}
                                    </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                    primary={user.email} // In a real app, use display name
                                    secondary={`Rank #${index + 1}`}
                                />
                                <Typography variant="h6" color="success.main" fontWeight="bold">
                                    ${user.walletBalance || 0}
                                </Typography>
                            </ListItem>
                            {index < users.length - 1 && <Divider variant="inset" component="li" />}
                        </React.Fragment>
                    ))}
                    {users.length === 0 && (
                        <ListItem>
                            <ListItemText primary="No high rollers yet." />
                        </ListItem>
                    )}
                </List>
            </Paper>

            <TransactionHistoryModal
                open={historyModalOpen}
                onClose={() => setHistoryModalOpen(false)}
                userId={selectedUser?.id}
                userEmail={selectedUser?.email}
            />
        </Box>
    );
};

export default HighRollers;
