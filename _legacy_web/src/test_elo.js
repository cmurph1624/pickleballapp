import { updateRatings } from './services/RatingEngine.js';

console.log("Testing ELO Rating Engine...");

// Mock Players
const p1 = { id: 'p1', hiddenRating: 35 }; // 3.5
const p2 = { id: 'p2', hiddenRating: 35 }; // 3.5
const p3 = { id: 'p3', hiddenRating: 35 }; // 3.5
const p4 = { id: 'p4', hiddenRating: 35 }; // 3.5

const strong1 = { id: 's1', hiddenRating: 45 }; // 4.5
const strong2 = { id: 's2', hiddenRating: 45 }; // 4.5

// Test 1: Equal Teams, Team 1 Wins
console.log("\n--- Test 1: Equal Teams (35 vs 35), Team 1 Wins ---");
const match1 = { id: 'm1', team1Score: 11, team2Score: 9 };
const res1 = updateRatings(match1, [p1, p2], [p3, p4]);
console.log("Result:", res1.map(p => `${p.id}: ${p.hiddenRating.toFixed(2)}`));
// Expected: T1 gains ~2 (K*0.5), T2 loses ~2. New: ~37, ~33.

// Test 2: Strong vs Weak, Strong Wins (Expected)
console.log("\n--- Test 2: Strong (45) vs Weak (35), Strong Wins ---");
const match2 = { id: 'm2', team1Score: 11, team2Score: 5 };
const res2 = updateRatings(match2, [strong1, strong2], [p3, p4]);
console.log("Result:", res2.map(p => `${p.id}: ${p.hiddenRating.toFixed(2)}`));
// Expected: T1 gains very little (e.g. 0.5), T2 loses little.

// Test 3: Strong vs Weak, Weak Wins (Upset)
console.log("\n--- Test 3: Strong (45) vs Weak (35), Weak Wins ---");
const match3 = { id: 'm3', team1Score: 5, team2Score: 11 };
const res3 = updateRatings(match3, [strong1, strong2], [p3, p4]);
console.log("Result:", res3.map(p => `${p.id}: ${p.hiddenRating.toFixed(2)}`));
// Expected: T1 loses a lot (e.g. 3.5), T2 gains a lot.
