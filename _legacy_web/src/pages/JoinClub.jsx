import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Box, Button, Typography, CircularProgress, Container, Paper } from '@mui/material';

const JoinClub = () => {
    const { clubId } = useParams();
    const { currentUser, login } = useAuth();
    const navigate = useNavigate();
    const [status, setStatus] = useState('loading'); // loading, error, ready, joining, waiting_for_login
    const [clubData, setClubData] = useState(null);

    // Fetch club data ONLY if user is logged in (otherwise permissions fail)
    useEffect(() => {
        if (!currentUser) {
            setStatus('waiting_for_login');
            return;
        }

        const fetchClub = async () => {
            try {
                const docRef = doc(db, 'clubs', clubId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setClubData(docSnap.data());
                    setStatus('ready');
                } else {
                    setStatus('error');
                }
            } catch (err) {
                console.error(err);
                setStatus('error');
            }
        };
        fetchClub();
    }, [clubId, currentUser]);

    // Check if already a member and redirect
    useEffect(() => {
        if (currentUser && clubData && status === 'ready') {
            const members = clubData.members || [];
            if (members.includes(currentUser.uid)) {
                console.log("User already a member, redirecting...");
                navigate('/');
            }
        }
    }, [currentUser, clubData, status, clubId, navigate]);

    const handleJoin = async () => {
        if (!currentUser) return;

        try {
            setStatus('joining');
            const clubRef = doc(db, 'clubs', clubId);
            await updateDoc(clubRef, {
                members: arrayUnion(currentUser.uid)
            });
            // Success! Redirect.
            navigate('/');
        } catch (error) {
            console.error("Error joining club:", error);
            alert("Error joining club: " + error.message);
            setStatus('ready');
        }
    };

    if (status === 'loading') {
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>;
    }

    if (status === 'error') {
        return (
            <Container maxWidth="sm" sx={{ mt: 4, textAlign: 'center' }}>
                <Typography variant="h5" color="error">Club not found or error loading.</Typography>
            </Container>
        );
    }

    return (
        <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
            <Paper elevation={3} sx={{ p: 4 }}>
                <Typography variant="h4" gutterBottom>
                    You are invited to join
                </Typography>

                {/* Only show Club Name if we have it (logged in) */}
                {clubData ? (
                    <Typography variant="h3" color="primary" gutterBottom sx={{ mb: 4 }}>
                        {clubData.name}
                    </Typography>
                ) : (
                    <Typography variant="h5" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
                        a Pickleball Club
                    </Typography>
                )}

                {!currentUser ? (
                    <Box sx={{ mt: 4 }}>
                        <Typography gutterBottom variant="h6">Please log in to accept the invitation.</Typography>
                        <Button variant="contained" size="large" onClick={login} sx={{ mt: 2 }}>
                            Log In with Google
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ mt: 4 }}>
                        <Typography gutterBottom>Logged in as <strong>{currentUser.email}</strong></Typography>

                        <Button
                            variant="contained"
                            size="large"
                            color="success"
                            onClick={handleJoin}
                            disabled={status === 'joining'}
                            sx={{ mt: 2, px: 5, py: 1.5, fontSize: '1.2rem' }}
                        >
                            {status === 'joining' ? <CircularProgress size={24} color="inherit" /> : 'Join Club Now'}
                        </Button>
                    </Box>
                )}
            </Paper>
        </Container>
    );
};

export default JoinClub;
