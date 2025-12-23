import React, { useState, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Tabs, Tab, Box, Typography,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';

const MatchFrequencyModal = ({ open, onClose, members = [], matches = [] }) => {
    const [tab, setTab] = useState(0);

    const { partnerMatrix, opponentMatrix, players } = useMemo(() => {
        // Sort players by name for consistent axis
        const sortedPlayers = [...members].sort((a, b) => a.firstName.localeCompare(b.firstName));

        const pMap = {};
        sortedPlayers.forEach(p => pMap[p.id] = 0); // Initialize index map

        const pMatrix = sortedPlayers.map(() => sortedPlayers.map(() => 0));
        const oMatrix = sortedPlayers.map(() => sortedPlayers.map(() => 0));

        // Helper to find index
        const getIndex = (id) => sortedPlayers.findIndex(p => p.id === id);

        matches.forEach(m => {
            const t1p1 = m.team1[0], t1p2 = m.team1[1];
            const t2p1 = m.team2[0], t2p2 = m.team2[1];

            const update = (matrix, id1, id2) => {
                const idx1 = getIndex(id1);
                const idx2 = getIndex(id2);
                if (idx1 !== -1 && idx2 !== -1) {
                    matrix[idx1][idx2]++;
                    matrix[idx2][idx1]++;
                }
            };

            // Partners
            update(pMatrix, t1p1, t1p2);
            update(pMatrix, t2p1, t2p2);

            // Opponents
            update(oMatrix, t1p1, t2p1);
            update(oMatrix, t1p1, t2p2);
            update(oMatrix, t1p2, t2p1);
            update(oMatrix, t1p2, t2p2);
        });

        return { partnerMatrix: pMatrix, opponentMatrix: oMatrix, players: sortedPlayers };
    }, [members, matches]);

    const getCellColor = (value, isPartner) => {
        if (value === 0) return '#f8d7da'; // Redish for 0
        if (value === 1) return '#d1e7dd'; // Greenish for 1 (Ideal)
        if (value > 1) return '#fff3cd'; // Yellowish for > 1 (Repeat)
        return 'inherit';
    };

    const renderMatrix = (matrix, isPartner) => (
        <TableContainer component={Paper} elevation={0} variant="outlined">
            <Table size="small">
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>vs</TableCell>
                        {players.map(p => (
                            <TableCell key={p.id} align="center" sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                                {p.firstName.substring(0, 3)}
                            </TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {players.map((p1, rIdx) => (
                        <TableRow key={p1.id}>
                            <TableCell component="th" scope="row" sx={{ fontWeight: 'bold', bgcolor: 'grey.50' }}>
                                {p1.firstName} {p1.lastName.substring(0, 1)}.
                            </TableCell>
                            {players.map((p2, cIdx) => {
                                if (rIdx === cIdx) {
                                    return <TableCell key={p2.id} sx={{ bgcolor: 'grey.200' }} />;
                                }
                                const val = matrix[rIdx][cIdx];
                                return (
                                    <TableCell
                                        key={p2.id}
                                        align="center"
                                        sx={{ bgcolor: getCellColor(val, isPartner) }}
                                    >
                                        {val}
                                    </TableCell>
                                );
                            })}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Match Analysis</DialogTitle>
            <DialogContent>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
                    <Tab label="Partner Frequency" />
                    <Tab label="Opponent Frequency" />
                </Tabs>

                {tab === 0 && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Ideal: 1 (Green). 0 (Red) means they haven't partnered. &gt;1 (Yellow) means repeat partners.
                        </Typography>
                        {renderMatrix(partnerMatrix, true)}
                    </Box>
                )}

                {tab === 1 && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Ideal: 1+ (Green). 0 (Red) means they haven't played against each other.
                        </Typography>
                        {renderMatrix(opponentMatrix, false)}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog >
    );
};

export default MatchFrequencyModal;
