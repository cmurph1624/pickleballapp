import { calculateSpread } from './services/Oddsmaker.js';

console.log("Testing Spread Calculation...");

// Test Case 1: Equal Ratings (Default)
const team1_equal = [{ hiddenRating: 35 }, { hiddenRating: 35 }];
const team2_equal = [{ hiddenRating: 35 }, { hiddenRating: 35 }];
const result1 = calculateSpread(team1_equal, team2_equal);
console.log("Equal Ratings (35 vs 35):", result1);

// Test Case 2: Different Ratings
const team1_strong = [{ hiddenRating: 45 }, { hiddenRating: 45 }]; // Avg 45 (4.5)
const team2_weak = [{ hiddenRating: 35 }, { hiddenRating: 35 }];   // Avg 35 (3.5)
// Diff = 10. Scaling 0.2 -> 2 points spread.
const result2 = calculateSpread(team1_strong, team2_weak);
console.log("Strong vs Weak (45 vs 35):", result2);

// Test Case 3: Missing Ratings (Defaults to 50)
const team1_missing = [{}, {}];
const team2_missing = [{}, {}];
const result3 = calculateSpread(team1_missing, team2_missing);
console.log("Missing Ratings (Defaults):", result3);

// Test Case 4: Mixed
const team1_mixed = [{ hiddenRating: 55 }, { hiddenRating: 55 }]; // Avg 55
const team2_mixed = [{ hiddenRating: 50 }, { hiddenRating: 50 }]; // Avg 50
// Diff = 5. Scaling 0.2 -> 1 point spread.
const result4 = calculateSpread(team1_mixed, team2_mixed);
console.log("Mixed (55 vs 50):", result4);
