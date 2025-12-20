import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Box } from '@mui/material';
import { collection, addDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

const PlayerModal = ({ open, onClose, player }) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        gender: 'Male',
        duprDoubles: '',
        duprSingles: '',
        linkedUserEmail: ''
    });

    useEffect(() => {
        if (player) {
            setFormData({
                firstName: player.firstName,
                lastName: player.lastName,
                gender: player.gender,
                duprDoubles: player.duprDoubles || '',
                duprSingles: player.duprSingles || '',
                linkedUserEmail: player.linkedUserEmail || ''
            });
        } else {
            setFormData({
                firstName: '',
                lastName: '',
                gender: 'Male',
                duprDoubles: '',
                duprSingles: '',
                linkedUserEmail: ''
            });
        }
    }, [player, open]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const data = {
            firstName: formData.firstName,
            lastName: formData.lastName,
            gender: formData.gender,
            duprDoubles: parseFloat(formData.duprDoubles) || null,
            duprSingles: parseFloat(formData.duprSingles) || null,
            linkedUserEmail: formData.linkedUserEmail ? formData.linkedUserEmail.trim().toLowerCase() : null,
            updatedAt: new Date()
        };

        // If linking a user, try to find them
        if (data.linkedUserEmail) {
            const searchEmail = data.linkedUserEmail; // It's already lowercased above

            // lookup by lowercase email (now that we enforce it)
            const q = query(collection(db, 'users'), where('email', '==', searchEmail));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                data.linkedUserId = userDoc.id;
            } else {
                // If not found, warn but proceed
                alert(`Warning: No user found with email "${data.linkedUserEmail}". The email will be saved on the player profile, but no system link was created. The user must sign up/log in first.`);
                // We proceed to save
            }
        }

        try {
            if (player) {
                await updateDoc(doc(db, 'players', player.id), data);
            } else {
                data.createdAt = new Date();
                data.createdBy = auth.currentUser ? auth.currentUser.uid : 'anonymous';
                // Initialize hiddenRating based on DUPR (e.g. 3.5 -> 35)
                const dupr = data.duprDoubles || 3.5;
                data.hiddenRating = dupr * 10;
                await addDoc(collection(db, 'players'), data);
            }
            onClose();
        } catch (error) {
            console.error("Error saving player:", error);
            alert("Error saving player: " + error.message);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>{player ? 'Edit Player' : 'Add Player'}</DialogTitle>
            <form onSubmit={handleSubmit}>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            label="First Name"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                            fullWidth
                        />
                        <TextField
                            label="Last Name"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                            fullWidth
                        />
                        <TextField
                            select
                            label="Gender"
                            name="gender"
                            value={formData.gender}
                            onChange={handleChange}
                            required
                            fullWidth
                        >
                            <MenuItem value="Male">Male</MenuItem>
                            <MenuItem value="Female">Female</MenuItem>
                        </TextField>
                        <TextField
                            label="DUPR Doubles"
                            name="duprDoubles"
                            type="number"
                            inputProps={{ step: "0.01", min: "0", max: "8.0" }}
                            value={formData.duprDoubles}
                            onChange={handleChange}
                            fullWidth
                        />
                        <TextField
                            label="DUPR Singles"
                            name="duprSingles"
                            type="number"
                            inputProps={{ step: "0.01", min: "0", max: "8.0" }}
                            value={formData.duprSingles}
                            onChange={handleChange}
                            fullWidth
                        />
                        <TextField
                            label="Linked User Email"
                            name="linkedUserEmail"
                            value={formData.linkedUserEmail}
                            onChange={handleChange}
                            fullWidth
                            helperText="Enter the email address the user signs in with to link this profile."
                        />
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

export default PlayerModal;
