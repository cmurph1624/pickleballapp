import { updateRatings } from './services/RatingEngine.js';

// 16 Mock Players (Same as betting simulation)
// Ratings: ~30 to 60
const mockPlayers = [
    { id: 'p1', name: 'Elite 1', hiddenRating: 60 },
    { id: 'p2', name: 'Elite 2', hiddenRating: 58 },
    { id: 'p3', name: 'Elite 3', hiddenRating: 57 },
    { id: 'p4', name: 'Elite 4', hiddenRating: 55 },
    { id: 'p5', name: 'Strong 1', hiddenRating: 52 },
    { id: 'p6', name: 'Strong 2', hiddenRating: 50 },
    { id: 'p7', name: 'Strong 3', hiddenRating: 48 },
    { id: 'p8', name: 'Strong 4', hiddenRating: 46 },
    { id: 'p9', name: 'Avg 1', hiddenRating: 44 },
    { id: 'p10', name: 'Avg 2', hiddenRating: 42 },
    { id: 'p11', name: 'Avg 3', hiddenRating: 40 },
    { id: 'p12', name: 'Avg 4', hiddenRating: 38 },
    { id: 'p13', name: 'Weak 1', hiddenRating: 36 },
    { id: 'p14', name: 'Weak 2', hiddenRating: 34 },
    { id: 'p15', name: 'Weak 3', hiddenRating: 32 },
    { id: 'p16', name: 'Weak 4', hiddenRating: 30 },
];

console.log("=== Rating System Simulation ===\n");

function runTest(testName, team1Indices, team2Indices, t1Score, t2Score) {
    // Clone players to avoid mutating the global list for subsequent tests (though updateRatings returns new objects, let's be safe)
    const team1 = team1Indices.map(i => ({ ...mockPlayers[i] }));
    const team2 = team2Indices.map(i => ({ ...mockPlayers[i] }));

    const match = { id: 'test_match', team1Score: t1Score, team2Score: t2Score };

    const t1Avg = team1.reduce((sum, p) => sum + p.hiddenRating, 0) / team1.length;
    const t2Avg = team2.reduce((sum, p) => sum + p.hiddenRating, 0) / team2.length;

    console.log(`Test Case: ${testName}`);
    console.log(`Score: ${t1Score} - ${t2Score}`);
    console.log(`Team 1 (Avg ${t1Avg.toFixed(2)}): ${team1.map(p => p.name).join(', ')}`);
    console.log(`Team 2 (Avg ${t2Avg.toFixed(2)}): ${team2.map(p => p.name).join(', ')}`);

    // Run Calculation
    // Note: 'updateRatings' returns a FLAT list of all updated players
    const updatedPlayers = updateRatings(match, team1, team2);

    console.log("Updates:");
    updatedPlayers.forEach(p => {
        // Find original
        const original = [...team1, ...team2].find(op => op.id === p.id);
        const change = p.hiddenRating - original.hiddenRating;
        console.log(`  ${p.name}: ${original.hiddenRating.toFixed(2)} -> ${p.hiddenRating.toFixed(2)} (Change: ${change > 0 ? '+' : ''}${change.toFixed(2)})`);
    });
    console.log("--------------------------------------------------\n");
}

// 1. Balanced Match (Even Ratings)
// Strong 2 & Avg 1 (50+44)/2 = 47 vs Strong 3 & Strong 4 (48+46)/2 = 47
// Team 1 Wins
runTest('Balanced Match (47 vs 47) - T1 Win', [5, 8], [6, 7], 11, 9);

// 2. Expected Mismatch
// Elite 1 & 2 (Avg 59) vs Weak 3 & 4 (Avg 31)
// T1 Wins (Expected)
runTest('Expected Mismatch (59 vs 31) - Fav Win', [0, 1], [14, 15], 11, 2);

// 3. Upset Mismatch
// Elite 1 & 2 (Avg 59) vs Weak 3 & 4 (Avg 31)
// T2 Wins (Major Upset)
runTest('Upset Mismatch (59 vs 31) - Dog Win', [0, 1], [14, 15], 2, 11);

// 4. Slight Edge Upset
// Strong 1 (52+42)/2=47 vs Avg 3 (40+38)/2=39
// Diff 8. T2 Wins.
runTest('Slight Edge Upset (47 vs 39) - Dog Win', [4, 9], [10, 11], 9, 11);
