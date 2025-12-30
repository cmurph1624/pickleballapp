import { calculateSpread } from './services/Oddsmaker.js';

// 16 Mock Players with varying hidden ratings (Scale roughly 3.0 to 6.0 mapped to 30-60 usually, but let's stick to the raw numbers used in Oddsmaker)
// Assuming hiddenRating is typically around 35 (3.5) to 55 (5.5) based on previous file views.
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

console.log("=== Betting Logic Simulation ===\n");

function runTest(testName, team1Indices, team2Indices) {
    const team1 = team1Indices.map(i => mockPlayers[i]);
    const team2 = team2Indices.map(i => mockPlayers[i]);

    const team1Names = team1.map(p => `${p.name} (${p.hiddenRating})`).join(', ');
    const team2Names = team2.map(p => `${p.name} (${p.hiddenRating})`).join(', ');

    const t1Avg = team1.reduce((sum, p) => sum + p.hiddenRating, 0) / team1.length;
    const t2Avg = team2.reduce((sum, p) => sum + p.hiddenRating, 0) / team2.length;
    const diff = t1Avg - t2Avg;

    console.log(`Test Case: ${testName}`);
    console.log(`Team 1: [${team1Names}] (Avg: ${t1Avg})`);
    console.log(`Team 2: [${team2Names}] (Avg: ${t2Avg})`);
    console.log(`Rating Diff: ${diff}`);

    const result = calculateSpread(team1, team2);
    console.log(`calculatedSpread result: Spread: ${result.spread}, Favorite: Team ${result.favoriteTeam || 'None'}`);
    console.log("--------------------------------------------------\n");
}

// Scenario 1: High Rating vs Low Rating
// Elite 1 & 2 vs Weak 3 & 4
// T1 Avg: (60+58)/2 = 59
// T2 Avg: (32+30)/2 = 31
// Diff: 28
// Likely huge spread
runTest('Mismatch: Elite vs Weak', [0, 1], [14, 15]);

// Scenario 2: Even Match
// Strong 2 & Avg 1 (50+44)/2 = 47
// Strong 3 & Strong 4 (48+46)/2 = 47
// Diff: 0
runTest('Even Match', [5, 8], [6, 7]);

// Scenario 3: Slight Edge
// Strong 1 & Avg 2 (52+42)/2 = 47
// Avg 3 & Avg 4 (40+38)/2 = 39
// Diff: 8
runTest('Moderate Favorites', [4, 9], [10, 11]);

// Scenario 4: User requested scenario
// "One test could be with one team both players have higher rating and than the 2 nd team has lower ratings"
// Let's do a slightly tighter one than Scenario 1
// Strong 1 & Strong 2 (52+50)/2 = 51
// Avg 1 & Avg 2 (44+42)/2 = 43
// Diff: 8
runTest('Strong vs Average', [4, 5], [8, 9]);
