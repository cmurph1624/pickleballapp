import React, { useState, useEffect } from 'react';
import { Typography, Box, Grid, Card, CardContent, CardActionArea, Fab, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, addDoc, onSnapshot, documentId } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { migrateToClubArchitecture } from '../services/MigrationService';

const ClubDashboard = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openModal, setOpenModal] = useState(false);
    const [newClubName, setNewClubName] = useState('');

    useEffect(() => {
        if (!currentUser) return;

        // Query clubs where user is listed in members
        // Note: 'array-contains' is needed
        const q = query(collection(db, 'clubs'), where('members', 'array-contains', currentUser.uid));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const clubsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setClubs(clubsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleCreateClub = async () => {
        if (!newClubName.trim()) return;
        try {
            const newClub = {
                name: newClubName,
                admins: [currentUser.uid],
                members: [currentUser.uid],
                createdAt: new Date(),
                createdBy: currentUser.uid
            };
            await addDoc(collection(db, 'clubs'), newClub);
            setOpenModal(false);
            setNewClubName('');
        } catch (error) {
            console.error("Error creating club:", error);
            alert("Error creating club");
        }
    };

    const runMigration = async () => {
        if (window.confirm("Run system migration? This will create the default club and move existing leagues to it.")) {
            try {
                await migrateToClubArchitecture(currentUser);
                alert("Migration Complete");
            } catch (e) {
                alert("Migration Failed: " + e.message);
            }
        }
    };

    if (loading) return <Typography>Loading Clubs...</Typography>;

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4">My Clubs</Typography>
                {/* Temporary Migration Button for Admin */}
                {currentUser && currentUser.isAdmin && (
                    <Button onClick={runMigration} color="warning" size="small">
                        Run Migration
                    </Button>
                )}
            </Box>

            <Grid container spacing={3}>
                {clubs.map((club) => (
                    <Grid item xs={12} sm={6} md={4} key={club.id}>
                        <Card>
                            <CardActionArea onClick={() => navigate(`/clubs/${club.id}/leagues`)}>
                                <CardContent sx={{ minHeight: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography variant="h5" align="center">
                                        {club.name}
                                    </Typography>
                                </CardContent>
                            </CardActionArea>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            <Fab
                color="primary"
                aria-label="add"
                sx={{ position: 'fixed', bottom: 30, right: 30 }}
                onClick={() => setOpenModal(true)}
            >
                <AddIcon />
            </Fab>

            <Dialog open={openModal} onClose={() => setOpenModal(false)}>
                <DialogTitle>Create New Club</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Club Name"
                        fullWidth
                        value={newClubName}
                        onChange={(e) => setNewClubName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenModal(false)}>Cancel</Button>
                    <Button onClick={handleCreateClub} variant="contained">Create</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ClubDashboard;
