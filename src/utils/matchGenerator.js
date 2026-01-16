export const generateMatches = (players, gamesPerPlayer, mode = "STRICT_SOCIAL") => {
    if (!players || players.length < 4) return [];

    const ITERATIONS = 2000;
    let bestMatches = [];
    let bestScore = Infinity;

    // SCORING CONFIGURATION
    // SCORING CONFIGURATION
    const SCORING = {
        STRICT_SOCIAL: {
            missedOpponent: 5000,
            missedPartner: 2000,
            repeatPartner: 20000, // Unified High Penalty
            repeatOpponent: 4000, // New: Penalize repeating opponents to spread them out
            skillVarianceType: 'linear', // 10 * diff
            skillVarianceWeight: 10
        },
        WEIGHTED_COMPETITIVE: {
            missedOpponent: 5000,
            missedPartner: 200,
            repeatPartner: 10000, // Extreme penalty to effectively ban repeats
            repeatOpponent: 100, // Competitive cares less about variety, more about skill
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
            stats[p.id] = { partners: {}, opponents: {}, gamesPlayed: 0 };
        });

        let totalPenalty = 0;
        let skillPenalty = 0;

        matches.forEach(m => {
            const p1 = players.find(p => p.id === m.team1[0]);
            const p2 = players.find(p => p.id === m.team1[1]);
            const p3 = players.find(p => p.id === m.team2[0]);
            const p4 = players.find(p => p.id === m.team2[1]);

            // Track Games Played
            stats[p1.id].gamesPlayed++;
            stats[p2.id].gamesPlayed++;
            stats[p3.id].gamesPlayed++;
            stats[p4.id].gamesPlayed++;

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
            // Check for Missing Games (Critical for Competitive)
            if (stats[p.id].gamesPlayed < gamesPerPlayer) {
                // Penalty needs to be higher than repeatPartner (10000) to ensure we prefer repeats over gaps
                totalPenalty += (gamesPerPlayer - stats[p.id].gamesPlayed) * 50000;
            }

            // Missed Partners & Repeat Partners
            players.forEach(other => {
                if (p.id === other.id) return;

                const partnerCount = stats[p.id].partners[other.id] || 0;

                if (partnerCount === 0) {
                    // Missed partner
                    totalPenalty += currentConfig.missedPartner;
                } else if (partnerCount > 1) {
                    // Repeat partner
                    totalPenalty += (partnerCount - 1) * currentConfig.repeatPartner;
                }

                const opponentCount = stats[p.id].opponents[other.id] || 0;
                if (opponentCount === 0) {
                    // Missed opponent
                    totalPenalty += currentConfig.missedOpponent;
                } else if (opponentCount > 1 && currentConfig.repeatOpponent) {
                    // Repeat opponent (New Penalty)
                    totalPenalty += (opponentCount - 1) * currentConfig.repeatOpponent;
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
            const repeatPartnerPenalty = mode === "WEIGHTED_COMPETITIVE" ? 10000 : 20000;
            score += checkPartner(p1, p2) * repeatPartnerPenalty;
            score += checkPartner(p3, p4) * repeatPartnerPenalty;

            // Opponent Repetition Penalty
            const checkOpponent = (player, opp) => (playerStats[player.id].opponents[opp.id] || 0);

            // Use config value or default high for Social, low for Comp if not defined (safe fallback)
            const repeatOppPenalty = currentConfig.repeatOpponent || 4000;

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

            if (candidates.length < 4) {
                break;
            }

            let matchPlayers = [];

            // Unified Robust Greedy Builder
            // Both modes now use the smarter builder to avoid trapping themselves.
            // The difference lies in how 'others' are sorted (Skill vs Random)

            candidates = shuffle(candidates);
            candidates.sort((a, b) => playerStats[a.id].gamesPlayed - playerStats[b.id].gamesPlayed);

            const p1 = candidates[0];
            const others = candidates.slice(1);

            if (mode === "WEIGHTED_COMPETITIVE") {
                const p1Rank = p1.hiddenRanking || 0;
                // Sort others primarily by skill difference to p1
                others.sort((a, b) => {
                    const diffA = Math.abs((a.hiddenRanking || 0) - p1Rank);
                    const diffB = Math.abs((b.hiddenRanking || 0) - p1Rank);
                    return diffA - diffB;
                });
            } else {
                // STRICT_SOCIAL:
                // 'others' is already shuffled (randomized), which provides the social mixing.
                // We keep them in random order to encourage meeting new people randomly.
            }

            // Greedy Group Builder (Randomized Window)
            matchPlayers = [p1];
            const SEARCH_WINDOW = 6; // Balanced sweet spot for 12 players

            while (matchPlayers.length < 4) {
                const validNext = [];

                // Find top N valid candidates from 'others'
                // Dynamic Sorting based on "Clash Score" with current group
                const candidateScores = others
                    .filter(c => !matchPlayers.some(mp => mp.id === c.id))
                    .map(c => {
                        let score = 0;
                        matchPlayers.forEach(existing => {
                            // Penalize if they have been partners (Hard check exists later, but this pushes them down)
                            score += (playerStats[c.id].partners[existing.id] || 0) * 100;
                            // Penalize if they have been opponents
                            score += (playerStats[c.id].opponents[existing.id] || 0);
                        });
                        return { player: c, score };
                    })
                    .sort((a, b) => a.score - b.score);

                for (const item of candidateScores) {
                    const candidate = item.player;
                    if (validNext.length >= SEARCH_WINDOW) break;

                    // Skip if already in the group (handled by filter, but double check)
                    if (matchPlayers.some(p => p.id === candidate.id)) continue;

                    // Pruning for 3rd Player:
                    if (matchPlayers.length === 2) {
                        const pA = matchPlayers[0], pB = matchPlayers[1], pC = candidate;
                        const abBad = (playerStats[pA.id].partners[pB.id] || 0) > 0;
                        const acBad = (playerStats[pA.id].partners[pC.id] || 0) > 0;
                        const bcBad = (playerStats[pB.id].partners[pC.id] || 0) > 0;

                        if (abBad && acBad && bcBad) continue;
                    }

                    // Special Check for the Final (4th) Player:
                    // Ensure that adding this player allows for at least ONE valid permutation (no repeats).
                    if (matchPlayers.length === 3) {
                        const pA = matchPlayers[0], pB = matchPlayers[1], pC = matchPlayers[2], pD = candidate;

                        const hasValidPerm = [
                            [[pA, pB], [pC, pD]],
                            [[pA, pC], [pB, pD]],
                            [[pA, pD], [pB, pC]]
                        ].some(perm => {
                            const t1p1 = perm[0][0], t1p2 = perm[0][1];
                            const t2p1 = perm[1][0], t2p2 = perm[1][1];
                            const bad1 = (playerStats[t1p1.id].partners[t1p2.id] || 0) > 0;
                            const bad2 = (playerStats[t2p1.id].partners[t2p2.id] || 0) > 0;
                            return !bad1 && !bad2;
                        });

                        if (!hasValidPerm) continue; // Reject: This group would be impossible to pair uniquely
                    }

                    // For 2nd/3rd player, we use the Relaxed Constraint to keep options open
                    let collisionCount = 0;
                    for (const existing of matchPlayers) {
                        if ((playerStats[existing.id].partners[candidate.id] || 0) > 0) {
                            collisionCount++;
                        }
                    }

                    // Relaxed Constraint:
                    // If they have at least one potential fresh partner, they are valid candidates.
                    if (collisionCount < matchPlayers.length) {
                        validNext.push(candidate.player || candidate);
                    }
                }

                // If we found valid candidates, pick one randomly
                if (validNext.length > 0) {
                    const pickIndex = Math.floor(Math.random() * validNext.length);
                    matchPlayers.push(validNext[pickIndex]);
                } else {
                    // Dead end: No valid unique partners found for this group.
                    break;
                }
            }

            // 3. Fallback: If we couldn't find 4 unique strangers, fill with best available
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
