
import { generateMatches } from '../utils/matchGenerator.js';

const runDebug = () => {
    const gamesPerPlayer = 7; // As per the screenshot (rounds 1-7)
    const numPlayers = 12; // Typical full court
    const mode = "WEIGHTED_COMPETITIVE";

    console.log(`Running Schedule Debug: ${numPlayers} players, ${gamesPerPlayer} games, mode: ${mode}`);

    // Create players with varied rankings to simulate the issue
    const players = Array.from({ length: numPlayers }, (_, i) => ({
        id: `p${i + 1}`,
        firstName: `Player`,
        lastName: `${i + 1}`,
        hiddenRanking: 1000 + (i * 50) // Wide range: 1000, 1050, ..., 1550
    }));

    const matches = generateMatches(players, gamesPerPlayer, mode);

    console.log(`Matches Generated: ${matches.length}`);

    // Analyze for Duplicate Partners
    const playerStats = {};
    players.forEach(p => playerStats[p.id] = { partners: {} });

    let duplicatePartners = 0;

    matches.forEach(m => {
        // Team 1
        const t1p1 = m.team1[0];
        const t1p2 = m.team1[1];

        // Team 2
        const t2p1 = m.team2[0];
        const t2p2 = m.team2[1];

        const recordStats = (p1, p2) => {
            playerStats[p1].partners[p2] = (playerStats[p1].partners[p2] || 0) + 1;
            playerStats[p2].partners[p1] = (playerStats[p2].partners[p1] || 0) + 1;
            if (playerStats[p1].partners[p2] > 1) {
                // Counts twice (once for A->B, once for B->A) so we will just divide by 2 at end or just track events
            }
        };

        recordStats(t1p1, t1p2);
        recordStats(t2p1, t2p2);
    });

    // Check for duplicates
    const issues = [];
    Object.keys(playerStats).forEach(pid => {
        Object.entries(playerStats[pid].partners).forEach(([partnerId, count]) => {
            if (count > 1) {
                issues.push(`${pid} & ${partnerId}: ${count} times`);
            }
        });
    });

    // Deduplicate the issues list (since A&B is same as B&A)
    const uniqueIssues = new Set();
    issues.forEach(issue => {
        const [names, countText] = issue.split(': ');
        const [p1, p2] = names.split(' & ');
        const key = [p1, p2].sort().join(' & ');
        uniqueIssues.add(`${key}: ${countText}`);
    });

    if (uniqueIssues.size > 0) {
        console.log("FAIL: Duplicate Partners Found:");
        uniqueIssues.forEach(i => console.log(` - ${i}`));
        console.log(`Total Unique Duplicate Pairs: ${uniqueIssues.size}`);
    } else {
        console.log("SUCCESS: No Duplicate Partners found.");
    }
};

runDebug();
