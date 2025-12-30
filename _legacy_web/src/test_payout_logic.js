import { calculateBetOutcome } from './services/BettingCalculations.js';

console.log("=== Payout Logic Testing ===\n");

function assert(condition, message) {
    if (condition) {
        console.log(`PASS: ${message}`);
    } else {
        console.error(`FAIL: ${message}`);
    }
}

// Helper to create bet object
const createBet = (teamPicked, spread, favoriteTeam) => ({
    teamPicked,
    spreadAtTimeOfBet: spread,
    favoriteTeamAtTimeOfBet: favoriteTeam
});

// SCENARIO 1: FAVORITE COVERS
// Team 1 Fav (-2.5). Score: T1 11 - T2 5. Diff 6. 6 > 2.5 -> WON
const bet1 = createBet(1, 2.5, 1);
const res1 = calculateBetOutcome(bet1, 11, 5);
assert(res1 === 'WON', "Favorite Covers (11-5, Spread 2.5)");

// SCENARIO 2: FAVORITE FAILS TO COVER (But wins game)
// Team 1 Fav (-5.5). Score: T1 11 - T2 8. Diff 3. 3 < 5.5 -> LOST
const bet2 = createBet(1, 5.5, 1);
const res2 = calculateBetOutcome(bet2, 11, 8);
assert(res2 === 'LOST', "Favorite Wins but Fails Cover (11-8, Spread 5.5)");

// SCENARIO 3: UNDERDOG COVERS (Loss < Spread)
// Team 2 Dog (+5.5). Score: T1 11 - T2 8. Diff 3. 3 < 5.5 -> WON
const bet3 = createBet(2, 5.5, 1); // Betting on Team 2, Team 1 is fav
const res3 = calculateBetOutcome(bet3, 11, 8);
assert(res3 === 'WON', "Underdog Covers Loss (11-8, Spread 5.5)");

// SCENARIO 4: UNDERDOG WINS OUTRIGHT
// Team 2 Dog (+2.5). Score: T1 9 - T2 11. Diff -2. -> WON
const bet4 = createBet(2, 2.5, 1);
const res4 = calculateBetOutcome(bet4, 9, 11);
assert(res4 === 'WON', "Underdog Wins Outright");

// SCENARIO 5: PUSH
// Team 1 Fav (-2). Score: T1 11 - T2 9. Diff 2. 2 == 2 -> PUSH
const bet5 = createBet(1, 2.0, 1);
const res5 = calculateBetOutcome(bet5, 11, 9);
assert(res5 === 'PUSH', "Push (Spread 2.0, Diff 2)");

// SCENARIO 6: PICK'EM (No Spread)
// Team 1 picked via Pick'em. Score 11-9 -> WON
const bet6 = createBet(1, 0, null);
const res6 = calculateBetOutcome(bet6, 11, 9);
assert(res6 === 'WON', "Pick'em Win");

console.log("\nTests Complete.");
