export const calculateStandings = (players, weeks) => {
    if (!players || !weeks) return [];

    // 1. Initialize Stats
    const stats = {};
    players.forEach(p => {
        stats[p.id] = {
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            wins: 0,
            losses: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            diff: 0,
            gamesPlayed: 0,
            h2h: {} // { opponentId: { wins: 0, losses: 0 } }
        };
    });

    // 2. Process Matches
    weeks.forEach(week => {
        if (!week.matches) return;

        week.matches.forEach(match => {
            // Skip if score is missing
            if (match.team1Score === undefined || match.team2Score === undefined) return;

            const t1Score = parseInt(match.team1Score);
            const t2Score = parseInt(match.team2Score);

            const team1 = match.team1; // [id, id]
            const team2 = match.team2; // [id, id]

            const t1Won = t1Score > t2Score;
            const t2Won = t2Score > t1Score;
            // Draw is possible in theory but usually not in Pickleball match play logic here, 
            // assuming binary win/loss for now based on score.

            // Update Team 1 Stats
            team1.forEach(pid => {
                if (!stats[pid]) return; // Safety check
                stats[pid].gamesPlayed++;
                stats[pid].pointsFor += t1Score;
                stats[pid].pointsAgainst += t2Score;
                stats[pid].diff += (t1Score - t2Score);

                if (t1Won) stats[pid].wins++;
                else if (t2Won) stats[pid].losses++;

                // H2H against Team 2 members
                team2.forEach(oppId => {
                    if (!stats[pid].h2h[oppId]) stats[pid].h2h[oppId] = { wins: 0, losses: 0 };
                    if (t1Won) stats[pid].h2h[oppId].wins++;
                    else if (t2Won) stats[pid].h2h[oppId].losses++;
                });
            });

            // Update Team 2 Stats
            team2.forEach(pid => {
                if (!stats[pid]) return;
                stats[pid].gamesPlayed++;
                stats[pid].pointsFor += t2Score;
                stats[pid].pointsAgainst += t1Score;
                stats[pid].diff += (t2Score - t1Score);

                if (t2Won) stats[pid].wins++;
                else if (t1Won) stats[pid].losses++;

                // H2H against Team 1 members
                team1.forEach(oppId => {
                    if (!stats[pid].h2h[oppId]) stats[pid].h2h[oppId] = { wins: 0, losses: 0 };
                    if (t2Won) stats[pid].h2h[oppId].wins++;
                    else if (t1Won) stats[pid].h2h[oppId].losses++;
                });
            });
        });
    });

    // 3. Convert to Array and Sort
    const standings = Object.values(stats);

    standings.sort((a, b) => {
        // 1. Wins (Descending)
        if (a.wins !== b.wins) return b.wins - a.wins;

        // 2. Point Differential (Descending)
        if (a.diff !== b.diff) return b.diff - a.diff;

        // 3. Head-to-Head
        // If a and b have played, who won more?
        const aVsB = a.h2h[b.id];
        if (aVsB) {
            if (aVsB.wins !== aVsB.losses) return aVsB.losses - aVsB.wins; // Note: if A has more wins vs B, A should be first. 
            // Wait, sort function: negative if a < b (a comes first).
            // If A has more wins, we want A first. So return negative.
            // b.wins - a.wins works for descending.
            // So here: return b's wins against a - a's wins against b? 
            // No, let's use the record:
            // If A beat B 2 times and B beat A 0 times. A is better.
            return aVsB.losses - aVsB.wins;
            // Example: A wins 2, losses 0. 0 - 2 = -2. A comes first. Correct.
        }

        return 0;
    });

    // Add Rank
    standings.forEach((p, index) => {
        p.rank = index + 1;
    });

    return standings;
};
