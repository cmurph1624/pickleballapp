export const generateMatches = (players, gamesPerPlayer, mode = "STRICT_SOCIAL") => {
    if (!players || players.length < 4) return [];

    const ITERATIONS = 2000;
    let bestMatches = [];
    let bestScore = Infinity;

    // SCORING CONFIGURATION
    const SCORING = {
        STRICT_SOCIAL: {
            missedOpponent: 5000,
            missedPartner: 2000,
            repeatPartner: 500,
            skillVarianceType: 'linear', // 10 * diff
            skillVarianceWeight: 10
        },
        WEIGHTED_COMPETITIVE: {
            missedOpponent: 5000,
            missedPartner: 200,
            repeatPartner: 10000, // Extreme penalty to effectively ban repeats
            skillVarianceType: 'squared', // 100 * diff^2
            skillVarianceWeight: 100
        }
    };

    const currentConfig = SCORING[mode] || SCORING.STRICT_SOCIAL;

    // Helper: Calculate Skill Variance Penalty for a match (Team A vs Team B)
    const getMatchSkillPenalty = (t1p1, t1p2, t2p1, t2p2) => {
        // Safe access to hiddenRanking, default to 0 if missing
        const r1 = t1p1.hiddenRanking || 0;
        const r2 = t1p2.hiddenRanking || 0;
        const r3 = t2p1.hiddenRanking || 0;
        const r4 = t2p2.hiddenRanking || 0;

        const rankings = [r1, r2, r3, r4];

        if (currentConfig.skillVarianceType === 'squared') {
            // Competitive: heavily penalize wide ranges in a single match
            // Calculate sum of squared differences between all pairs to ensure tightness
            let sumSqDiff = 0;
            for (let i = 0; i < 4; i++) {
                for (let j = i + 1; j < 4; j++) {
                    const diff = rankings[i] - rankings[j];
                    sumSqDiff += diff * diff;
                }
            }
            return sumSqDiff * currentConfig.skillVarianceWeight;
        } else {
            // Social: Tie-breaker, linear variance
            // Just sum of absolute differences
            let sumDiff = 0;
            for (let i = 0; i < 4; i++) {
                for (let j = i + 1; j < 4; j++) {
                    sumDiff += Math.abs(rankings[i] - rankings[j]);
                }
            }
            return sumDiff * currentConfig.skillVarianceWeight;
        }
    };

    // Helper to calculate the quality of a full schedule (lower is better)
    const evaluateSchedule = (matches, players) => {
        const stats = {};
        players.forEach(p => {
            stats[p.id] = { partners: {}, opponents: {} };
        });

        let totalPenalty = 0;
        let skillPenalty = 0;

        matches.forEach(m => {
            const p1 = players.find(p => p.id === m.team1[0]);
            const p2 = players.find(p => p.id === m.team1[1]);
            const p3 = players.find(p => p.id === m.team2[0]);
            const p4 = players.find(p => p.id === m.team2[1]);

            // Track Partners
            stats[p1.id].partners[p2.id] = (stats[p1.id].partners[p2.id] || 0) + 1;
            stats[p2.id].partners[p1.id] = (stats[p2.id].partners[p1.id] || 0) + 1;
            stats[p3.id].partners[p4.id] = (stats[p3.id].partners[p4.id] || 0) + 1;
            stats[p4.id].partners[p3.id] = (stats[p4.id].partners[p3.id] || 0) + 1;

            // Track Opponents
            [p1, p2].forEach(team1Player => {
                [p3, p4].forEach(team2Player => {
                    stats[team1Player.id].opponents[team2Player.id] = (stats[team1Player.id].opponents[team2Player.id] || 0) + 1;
                    stats[team2Player.id].opponents[team1Player.id] = (stats[team2Player.id].opponents[team1Player.id] || 0) + 1;
                });
            });

            // Add Skill Penalty for this match
            skillPenalty += getMatchSkillPenalty(p1, p2, p3, p4);
        });

        totalPenalty += skillPenalty;

        // Calculate Global Penalties
        players.forEach(p => {
            // Missed Partners & Repeat Partners
            players.forEach(other => {
                if (p.id === other.id) return;

                const partnerCount = stats[p.id].partners[other.id] || 0;

                if (partnerCount === 0) {
                    // Missed partner (divided by 2 because we count it for both sides, loop handles each player)
                    // But we want to penalize the SCHEDULE state.
                    // If A missed B, A gets penalty. B gets penalty. Total = 2 * penalty.
                    // This aligns with "Score: Calculate a 'Penalty Score' for each schedule".
                    totalPenalty += currentConfig.missedPartner;
                } else if (partnerCount > 1) {
                    // Repeat partner
                    totalPenalty += (partnerCount - 1) * currentConfig.repeatPartner;
                }

                const opponentCount = stats[p.id].opponents[other.id] || 0;
                if (opponentCount === 0) {
                    // Missed opponent
                    totalPenalty += currentConfig.missedOpponent;
                }
            });
        });

        return totalPenalty;
    };

    const generateSingleSchedule = () => {
        const matches = [];
        const playerStats = {};

        // Initialize stats
        players.forEach(p => {
            playerStats[p.id] = {
                gamesPlayed: 0,
                partners: {},
                opponents: {}
            };
        });

        const totalSlots = players.length * gamesPerPlayer;
        const totalMatches = Math.floor(totalSlots / 4);

        // Helper to get greedy score for a potential match (lower is better)
        const getHeuristicScore = (p1, p2, p3, p4) => {
            let score = 0;

            // Repetition Heuristics
            const checkPartner = (a, b) => (playerStats[a.id].partners[b.id] || 0);

            // Partner Repetition Penalty
            const repeatPartnerPenalty = mode === "WEIGHTED_COMPETITIVE" ? 10000 : 500;
            score += checkPartner(p1, p2) * repeatPartnerPenalty;
            score += checkPartner(p3, p4) * repeatPartnerPenalty;

            // Opponent Repetition Penalty
            const checkOpponent = (player, opp) => (playerStats[player.id].opponents[opp.id] || 0);
            const repeatOppPenalty = 200;

            score += checkOpponent(p1, p3) * repeatOppPenalty;
            score += checkOpponent(p1, p4) * repeatOppPenalty;
            score += checkOpponent(p2, p3) * repeatOppPenalty;
            score += checkOpponent(p2, p4) * repeatOppPenalty;

            // Skill Heuristic
            const skillCost = getMatchSkillPenalty(p1, p2, p3, p4);
            score += skillCost;

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

        let currentRoundMatches = 0;
        let currentRoundPlayers = new Set();
        const matchesPerRound = Math.floor(players.length / 4);

        for (let i = 0; i < totalMatches; i++) {
            // Check if we are starting a new round
            if (matchesPerRound > 0 && currentRoundMatches >= matchesPerRound) {
                currentRoundMatches = 0;
                currentRoundPlayers.clear();
            }

            // Filter candidates who need games AND are not in the current round
            let candidates = players.filter(p =>
                playerStats[p.id].gamesPlayed < gamesPerPlayer &&
                !currentRoundPlayers.has(p.id)
            );

            // If we can't find enough unique players for this round, we might be stuck.
            // In a greedy approach, this might happen. Strict constraints might need backtracking (simulated annealing),
            // but for now, let's just break or try to do best effort matching if we are desperate,
            // though the requirement is STRICT unique. 
            // If candidates < 4, this iteration fails to fill the round perfectly.
            // With 2000 iterations, we hope to find one that fits.
            if (candidates.length < 4) {
                // Optimization: If we can't fill the round, this schedule is likely bad.
                // We could potentially break early, but let's let it finish with what it has?
                // Actually, if we break here, we get a partial schedule.
                // If we relax the round constraint, we get duplicates.
                // Let's try to proceed looking for ANY needed candidates if STRICT filtering fails?
                // No, requirement is to FIX the duplication. So we must stop if no valid candidates.
                break;
            }

            let matchPlayers = [];

            if (mode === "WEIGHTED_COMPETITIVE") {
                // 1. Pick primary candidate (needs games most, random tie-break)
                candidates = shuffle(candidates);
                candidates.sort((a, b) => playerStats[a.id].gamesPlayed - playerStats[b.id].gamesPlayed);

                const p1 = candidates[0];
                const others = candidates.slice(1);
                const p1Rank = p1.hiddenRanking || 0;

                // Sort others primarily by skill difference to p1
                others.sort((a, b) => {
                    const diffA = Math.abs((a.hiddenRanking || 0) - p1Rank);
                    const diffB = Math.abs((b.hiddenRanking || 0) - p1Rank);
                    return diffA - diffB;
                });

                // 2. Greedy Group Builder
                // Build the group by adding people who have NOT partnered with ANYONE in the current group
                matchPlayers = [p1];

                for (const candidate of others) {
                    if (matchPlayers.length >= 4) break;

                    // Check collision with everyone currently in the group
                    let hasPartneredWithAny = false;
                    for (const existing of matchPlayers) {
                        if ((playerStats[existing.id].partners[candidate.id] || 0) > 0) {
                            hasPartneredWithAny = true;
                            break;
                        }
                    }

                    if (!hasPartneredWithAny) {
                        matchPlayers.push(candidate);
                    }
                }

                // 3. Fallback: If we couldn't find 4 unique strangers, fill with best skill matches
                // (This handles the edge case where it's mathematically impossible to avoid repeats)
                if (matchPlayers.length < 4) {
                    const set = new Set(matchPlayers.map(p => p.id));
                    for (const candidate of others) {
                        if (matchPlayers.length >= 4) break;
                        if (!set.has(candidate.id)) {
                            matchPlayers.push(candidate);
                            set.add(candidate.id);
                        }
                    }
                }
            } else {
                // Standard Random (Social)
                // 1. Pick primary candidate
                candidates = shuffle(candidates);
                candidates.sort((a, b) => playerStats[a.id].gamesPlayed - playerStats[b.id].gamesPlayed);

                const p1 = candidates[0];
                const others = candidates.slice(1);
                // Note: 'others' is already shuffled, which is what we want for Social.

                // 2. Greedy Group Builder
                matchPlayers = [p1];

                for (const candidate of others) {
                    if (matchPlayers.length >= 4) break;

                    // Check collision
                    let hasPartneredWithAny = false;
                    for (const existing of matchPlayers) {
                        if ((playerStats[existing.id].partners[candidate.id] || 0) > 0) {
                            hasPartneredWithAny = true;
                            break;
                        }
                    }

                    if (!hasPartneredWithAny) {
                        matchPlayers.push(candidate);
                    }
                }

                // 3. Fallback
                if (matchPlayers.length < 4) {
                    const set = new Set(matchPlayers.map(p => p.id));
                    for (const candidate of others) {
                        if (matchPlayers.length >= 4) break;
                        if (!set.has(candidate.id)) {
                            matchPlayers.push(candidate);
                            set.add(candidate.id);
                        }
                    }
                }
            }

            const permutations = [
                [[matchPlayers[0], matchPlayers[1]], [matchPlayers[2], matchPlayers[3]]],
                [[matchPlayers[0], matchPlayers[2]], [matchPlayers[1], matchPlayers[3]]],
                [[matchPlayers[0], matchPlayers[3]], [matchPlayers[1], matchPlayers[2]]]
            ];

            let bestMatch = null;
            let minScore = Infinity;

            permutations.forEach(perm => {
                const [t1, t2] = perm;
                const score = getHeuristicScore(t1[0], t1[1], t2[0], t2[1]);
                if (score < minScore) {
                    minScore = score;
                    bestMatch = { team1: t1, team2: t2 };
                }
            });

            if (bestMatch) {
                const { team1, team2 } = bestMatch;
                const matchId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).substring(2);

                matches.push({
                    id: matchId,
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

                // Track players for this round
                currentRoundPlayers.add(team1[0].id);
                currentRoundPlayers.add(team1[1].id);
                currentRoundPlayers.add(team2[0].id);
                currentRoundPlayers.add(team2[1].id);
                currentRoundMatches++;
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
