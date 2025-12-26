
/**
 * Validates a generated schedule to ensure no player is double-booked within the same round.
 * 
 * @param {Array} matches - The flat list of match objects
 * @param {Array} players - The list of player objects available for this week
 * @returns {Object} result - { isValid: boolean, error: string | null }
 */
export const validateSchedule = (matches, players) => {
    if (!matches || matches.length === 0) {
        return { isValid: true, error: null };
    }

    const matchesPerRound = Math.floor(players.length / 4);

    // If less than 4 players, there are no valid rounds really, but also no concurrent matches.
    if (matchesPerRound < 1) {
        return { isValid: true, error: null };
    }

    // Iterate through matches in chunks of matchesPerRound
    for (let i = 0; i < matches.length; i += matchesPerRound) {
        const roundIndex = (i / matchesPerRound) + 1;
        const roundMatches = matches.slice(i, i + matchesPerRound); // The matches in this round

        // Track players seen in this round
        const seenPlayers = new Set();
        const duplicates = new Set();

        for (const match of roundMatches) {
            const matchPlayers = [...match.team1, ...match.team2];

            for (const playerId of matchPlayers) {
                if (seenPlayers.has(playerId)) {
                    duplicates.add(playerId);
                } else {
                    seenPlayers.add(playerId);
                }
            }
        }

        if (duplicates.size > 0) {
            // Find names for the error message if possible
            const duplicateNames = Array.from(duplicates).map(id => {
                const p = players.find(player => player.id === id);
                return p ? `${p.firstName} ${p.lastName}` : id;
            });

            return {
                isValid: false,
                error: `Schedule Error: Found duplicate players in Round ${roundIndex}: ${duplicateNames.join(', ')}. Matches NOT saved.`
            };
        }
    }

    return { isValid: true, error: null };
};
