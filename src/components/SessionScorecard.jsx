import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';

const SessionScorecard = ({ sessionName, matches, players, courts }) => {

    // Group matches into rounds
    const rounds = useMemo(() => {
        if (!matches.length) return [];
        const matchesPerRound = Math.floor(players.length / 4);
        const chunkSize = matchesPerRound > 0 ? matchesPerRound : 1;
        const result = [];
        for (let i = 0; i < matches.length; i += chunkSize) {
            result.push(matches.slice(i, i + chunkSize));
        }
        return result;
    }, [matches, players]);

    const getPlayerName = (id) => {
        const p = players.find(player => player.id === id);
        return p ? `${p.firstName} ${p.lastName.substring(0, 1)}` : 'Unknown';
    };

    return (
        <Box sx={{ width: '100%', p: 2, height: '100%', color: 'black' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, borderBottom: '2px solid black', pb: 1 }}>
                <Typography variant="h5" fontWeight="bold">{sessionName}</Typography>
                <Typography variant="body2">Pickleball Schedule</Typography>
            </Box>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed', color: 'black' }}>
                <thead>
                    <tr>
                        <th style={{ width: '60px', border: '1px solid black', padding: '4px', background: '#e0e0e0' }}>Round</th>
                        {/* Assuming max 3 matches per round for the column headers, or just generic header */}
                        {[0, 1, 2].map(i => {
                            const raw = courts && courts[i] ? courts[i] : `Match ${i + 1}`;
                            const display = /^\d+$/.test(raw) ? `Court ${raw}` : raw;
                            return <th key={i} style={{ border: '1px solid black', padding: '4px', background: '#e0e0e0' }}>{display}</th>;
                        })}
                    </tr>
                </thead>
                <tbody>
                    {rounds.map((roundMatches, roundIndex) => (
                        <tr key={roundIndex} style={{ backgroundColor: roundIndex % 2 === 0 ? '#f9f9f9' : 'white' }}>
                            <td style={{ border: '1px solid black', padding: '8px', fontWeight: 'bold', textAlign: 'center' }}>
                                Round {roundIndex + 1}
                            </td>
                            {[0, 1, 2].map(matchIndex => {
                                const match = roundMatches[matchIndex];
                                if (!match) {
                                    return <td key={matchIndex} style={{ border: '1px solid black', padding: '8px' }}></td>;
                                }

                                const p1 = getPlayerName(match.team1[0]);
                                const p2 = getPlayerName(match.team1[1]);
                                const p3 = getPlayerName(match.team2[0]);
                                const p4 = getPlayerName(match.team2[1]);

                                const spread1 = match.spread > 0 && match.favoriteTeam === 1 ? `(-${match.spread})` : '';
                                const spread2 = match.spread > 0 && match.favoriteTeam === 2 ? `(-${match.spread})` : '';

                                return (
                                    <td key={matchIndex} style={{ border: '1px solid black', padding: '4px 8px', verticalAlign: 'middle' }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontWeight: match.favoriteTeam === 1 ? 'bold' : 'normal' }}>
                                                    {p1} & {p2}
                                                </span>
                                                {spread1 && <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{spread1}</span>}
                                            </Box>
                                            <Box sx={{ textAlign: 'center', fontSize: '9px', color: 'black', my: -0.5 }}>vs</Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ fontWeight: match.favoriteTeam === 2 ? 'bold' : 'normal' }}>
                                                    {p3} & {p4}
                                                </span>
                                                {spread2 && <span style={{ fontSize: '10px', fontWeight: 'bold' }}>{spread2}</span>}
                                            </Box>


                                        </Box>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </Box>
    );
};

export default SessionScorecard;
