import React, { useState, useEffect } from 'react';
import { Typography, Box, List, ListItem, ListItemText, IconButton, Fab, Paper, ListItemButton } from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, where } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebase';
import LeagueModal from '../components/LeagueModal';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';

const Leagues = () => {
    const [leagues, setLeagues] = useState([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedLeague, setSelectedLeague] = useState(null);
    const navigate = useNavigate();

    const { currentUser } = useAuth();
    const { clubId, isAdmin } = useClub();

    useEffect(() => {
        if (!clubId) return;

        // REMOVED orderBy to avoid "Missing Index" error on creation
        const q = query(collection(db, 'leagues'), where('clubId', '==', clubId));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const leaguesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Sort client-side
            leaguesData.sort((a, b) => {
                if (!a.startDate) return 1;
                if (!b.startDate) return -1;
                return b.startDate.localeCompare(a.startDate);
            });
            setLeagues(leaguesData);
        });

        return () => unsubscribe();
    }, [clubId]);

    const handleAdd = () => {
        setSelectedLeague(null);
        setModalOpen(true);
    };

    const handleEdit = (e, league) => {
        e.stopPropagation();
        setSelectedLeague(league);
        setModalOpen(true);
    };

    const handleDelete = async (e, league) => {
        e.stopPropagation();
        if (window.confirm(`Delete ${league.name}?`)) {
            try {
                await deleteDoc(doc(db, 'leagues', league.id));
            } catch (error) {
                console.error("Error deleting league:", error);
                alert("Error deleting league: " + error.message);
            }
        }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedLeague(null);
    };

    return (
        <Box>
            <Typography variant="h4" gutterBottom>Leagues</Typography>

            <List>
                {leagues.map((league) => (
                    <Paper key={league.id} sx={{ mb: 1 }}>
                        <ListItem
                            disablePadding
                            secondaryAction={
                                isAdmin && (
                                    <Box>
                                        <IconButton onClick={(e) => handleEdit(e, league)} color="primary">
                                            <EditIcon />
                                        </IconButton>
                                        <IconButton onClick={(e) => handleDelete(e, league)} color="error">
                                            <DeleteIcon />
                                        </IconButton>
                                    </Box>
                                )
                            }
                        >
                            <ListItemButton onClick={() => navigate(`/clubs/${clubId}/leagues/${league.id}`)}>
                                <ListItemText
                                    primary={league.name}
                                    secondary={
                                        <>
                                            <Typography variant="body2" component="span" display="block">
                                                {league.type} | {league.startDate} to {league.endDate}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {league.players ? league.players.length : 0} Players
                                            </Typography>
                                        </>
                                    }
                                />
                            </ListItemButton>
                        </ListItem>
                    </Paper>
                ))}
            </List>

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

            <LeagueModal
                open={modalOpen}
                onClose={handleCloseModal}
                league={selectedLeague}
            />
        </Box>
    );
};

export default Leagues;
