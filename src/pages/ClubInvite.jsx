import React from 'react';
import { Box, Typography, Button, Paper, TextField, InputAdornment, IconButton, Tooltip } from '@mui/material';
import QRCode from 'react-qr-code';
import { useParams, useNavigate } from 'react-router-dom';
import { ContentCopy, ArrowBack } from '@mui/icons-material';

const ClubInvite = () => {
    const { clubId } = useParams();
    const navigate = useNavigate();

    // Construct the invite URL
    // Use window.location.origin to get the current domain (e.g. localhost:5173 or myapp.web.app)
    const inviteUrl = `${window.location.origin}/join/${clubId}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(inviteUrl);
        // Could show a snackbar here, but simple alert or visual feedback is fine for now
        alert("Invite link copied to clipboard!");
    };

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center', mt: 4 }}>
            <Button
                startIcon={<ArrowBack />}
                onClick={() => navigate(-1)}
                sx={{ mb: 2, alignSelf: 'flex-start' }}
            >
                Back to Players
            </Button>

            <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Invite New Players
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Scan this QR code or copy the link below to invite players to join this club.
                    </Typography>
                </Box>

                <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid #eee' }}>
                    <QRCode value={inviteUrl} size={256} />
                </Box>

                <Box sx={{ width: '100%' }}>
                    <TextField
                        fullWidth
                        value={inviteUrl}
                        InputProps={{
                            readOnly: true,
                            endAdornment: (
                                <InputAdornment position="end">
                                    <Tooltip title="Copy Link">
                                        <IconButton onClick={handleCopy} edge="end">
                                            <ContentCopy />
                                        </IconButton>
                                    </Tooltip>
                                </InputAdornment>
                            ),
                        }}
                        variant="outlined"
                        label="Invite Link"
                    />
                </Box>

                <Button
                    variant="contained"
                    size="large"
                    fullWidth
                    onClick={handleCopy}
                    startIcon={<ContentCopy />}
                >
                    Copy Invite Link
                </Button>
            </Paper>
        </Box>
    );
};

export default ClubInvite;
