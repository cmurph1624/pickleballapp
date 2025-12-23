export const generateMatches = (players, gamesPerPlayer) => {
    if (!players || players.length < 4) return [];

    const ITERATIONS = 2000;
    let bestMatches = [];
    let bestScore = Infinity;

    // Helper to calculate the quality of a full schedule (lower is better)
    const evaluateSchedule = (matches, players) => {
        const stats = {};
        players.forEach(p => {
            stats[p.id] = { partners: {}, opponents: {} };
        });

        matches.forEach(m => {
            const t1p1 = m.team1[0], t1p2 = m.team1[1];
            const t2p1 = m.team2[0], t2p2 = m.team2[1];

            // Partners
            stats[t1p1].partners[t1p2] = (stats[t1p1].partners[t1p2] || 0) + 1;
            stats[t1p2].partners[t1p1] = (stats[t1p2].partners[t1p1] || 0) + 1;
            stats[t2p1].partners[t2p2] = (stats[t2p1].partners[t2p2] || 0) + 1;
            stats[t2p2].partners[t2p1] = (stats[t2p2].partners[t2p1] || 0) + 1;

            // Opponents
            [t1p1, t1p2].forEach(p1 => {
                [t2p1, t2p2].forEach(p2 => {
                    stats[p1].opponents[p2] = (stats[p1].opponents[p2] || 0) + 1;
                    stats[p2].opponents[p1] = (stats[p2].opponents[p1] || 0) + 1;
                });
            });
        });

        let totalVariance = 0;
        let missingOpponentPenalty = 0;

        // Calculate variance for partners and opponents
        players.forEach(p => {
            const partnerCounts = Object.values(stats[p.id].partners);
            const opponentCounts = Object.values(stats[p.id].opponents);

            // We want these counts to be as flat as possible (mostly 0s and 1s, few 2s)
            // Sum of squares is a good proxy for "clumpiness"
            const partnerSumSq = partnerCounts.reduce((sum, val) => sum + (val * val), 0);
            const opponentSumSq = opponentCounts.reduce((sum, val) => sum + (val * val), 0);

            // Heavily penalize repeat partners (more than repeat opponents)
            totalVariance += (partnerSumSq * 10) + opponentSumSq;

            // Check if played against everyone
            players.forEach(opponent => {
                if (p.id !== opponent.id) {
                    if (!stats[p.id].opponents[opponent.id]) {
                        missingOpponentPenalty += 5000; // Large penalty for not playing someone
                    }
                }
            });
        });

        return totalVariance + missingOpponentPenalty;
    };

    const generateSingleSchedule = () => {
        const matches = [];
        const playerStats = {};

        // Initialize stats
        players.forEach(p => {
            playerStats[p.id] = {
                gamesPlayed: 0,
                partners: {}, // { playerId: count }
                opponents: {} // { playerId: count }
            };
        });

        const totalSlots = players.length * gamesPerPlayer;
        const totalMatches = Math.floor(totalSlots / 4);

        // Helper to get score for a potential match (lower is better)
        const getMatchScore = (p1, p2, p3, p4) => {
            let score = 0;

            // Penalty for repeat partners (High weight)
            score += (playerStats[p1.id].partners[p2.id] || 0) * 50;
            score += (playerStats[p3.id].partners[p4.id] || 0) * 50;

            // Penalty for repeat opponents (Increased weight)
            const checkOpponent = (player, opp) => (playerStats[player.id].opponents[opp.id] || 0);

            score += checkOpponent(p1, p3) * 5;
            score += checkOpponent(p1, p4) * 5;
            score += checkOpponent(p2, p3) * 5;
            score += checkOpponent(p2, p4) * 5;

            // Incentive for playing new opponents
            // If they haven't played, we WANT this match (negative score)
            const checkNewOpponent = (player, opp) => {
                return (playerStats[player.id].opponents[opp.id] || 0) === 0 ? -500 : 0;
            };

            score += checkNewOpponent(p1, p3);
            score += checkNewOpponent(p1, p4);
            score += checkNewOpponent(p2, p3);
            score += checkNewOpponent(p2, p4);

            return score;
        };

        // Fisher-Yates Shuffle
        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        for (let i = 0; i < totalMatches; i++) {
            let candidates = players.filter(p => playerStats[p.id].gamesPlayed < gamesPerPlayer);
            if (candidates.length < 4) break;

            candidates = shuffle(candidates);
            candidates.sort((a, b) => playerStats[a.id].gamesPlayed - playerStats[b.id].gamesPlayed);

            let matchPlayers = candidates.slice(0, 4);

            const permutations = [
                [[matchPlayers[0], matchPlayers[1]], [matchPlayers[2], matchPlayers[3]]],
                [[matchPlayers[0], matchPlayers[2]], [matchPlayers[1], matchPlayers[3]]],
                [[matchPlayers[0], matchPlayers[3]], [matchPlayers[1], matchPlayers[2]]]
            ];

            let bestMatch = null;
            let minScore = Infinity;

            permutations.forEach(perm => {
                const [t1, t2] = perm;
                const score = getMatchScore(t1[0], t1[1], t2[0], t2[1]);
                if (score < minScore) {
                    minScore = score;
                    bestMatch = { team1: t1, team2: t2 };
                }
            });

            if (bestMatch) {
                const { team1, team2 } = bestMatch;
                matches.push({
                    id: crypto.randomUUID(),
                    team1: team1.map(p => p.id),
                    team2: team2.map(p => p.id)
                });

                const updateStats = (p, partner, opp1, opp2) => {
                    playerStats[p.id].gamesPlayed++;
                    playerStats[p.id].partners[partner.id] = (playerStats[p.id].partners[partner.id] || 0) + 1;
                    playerStats[p.id].opponents[opp1.id] = (playerStats[p.id].opponents[opp1.id] || 0) + 1;
                    playerStats[p.id].opponents[opp2.id] = (playerStats[p.id].opponents[opp2.id] || 0) + 1;
                };

                updateStats(team1[0], team1[1], team2[0], team2[1]);
                updateStats(team1[1], team1[0], team2[0], team2[1]);
                updateStats(team2[0], team2[1], team1[0], team1[1]);
                updateStats(team2[1], team2[0], team1[0], team1[1]);
            }
        }
        return matches;
    };

    // Run multiple iterations and keep the best one
    for (let i = 0; i < ITERATIONS; i++) {
        const schedule = generateSingleSchedule();
        const score = evaluateSchedule(schedule, players);

        if (score < bestScore) {
            bestScore = score;
            bestMatches = schedule;
        }
    }

    return bestMatches;
};
