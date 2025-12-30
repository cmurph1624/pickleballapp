/**
 * RatingEngine Service
 * Responsible for updating player ratings based on match results.
 * This is where we can plug in ML/LLM logic later.
 */

export const updateRatings = (match, team1Players, team2Players) => {
    console.log("RatingEngine: Calculating updates for match", match.id);

    const team1Score = parseInt(match.team1Score);
    const team2Score = parseInt(match.team2Score);

    // 1. Calculate Team Averages
    const team1Avg = team1Players.reduce((sum, p) => sum + (p.hiddenRating || 35), 0) / team1Players.length;
    const team2Avg = team2Players.reduce((sum, p) => sum + (p.hiddenRating || 35), 0) / team2Players.length;

    // 2. ELO Parameters
    const K_FACTOR = 4; // Max change per match (0.4 DUPR)
    const SCALE_FACTOR = 40; // 4.0 DUPR difference = 90% win probability

    // 3. Calculate Expected Score for Team 1
    // Formula: 1 / (1 + 10 ^ ((RatingB - RatingA) / Scale))
    const expectedScoreTeam1 = 1 / (1 + Math.pow(10, (team2Avg - team1Avg) / SCALE_FACTOR));

    // 4. Determine Actual Score (1 = Win, 0 = Loss, 0.5 = Draw)
    let actualScoreTeam1;
    if (team1Score > team2Score) {
        actualScoreTeam1 = 1;
    } else if (team1Score < team2Score) {
        actualScoreTeam1 = 0;
    } else {
        actualScoreTeam1 = 0.5; // Draw
    }

    // 5. Calculate Rating Change
    // Change = K * (Actual - Expected)
    const ratingChange = K_FACTOR * (actualScoreTeam1 - expectedScoreTeam1);

    console.log(`RatingEngine: T1 Avg: ${team1Avg}, T2 Avg: ${team2Avg}, Expected: ${expectedScoreTeam1.toFixed(2)}, Actual: ${actualScoreTeam1}, Change: ${ratingChange.toFixed(2)}`);

    // 6. Update Team 1 Players
    const updatedTeam1 = team1Players.map(p => ({
        ...p,
        hiddenRating: Math.max(0, (p.hiddenRating || 35) + ratingChange)
    }));

    // 7. Update Team 2 Players (Opposite change)
    const updatedTeam2 = team2Players.map(p => ({
        ...p,
        hiddenRating: Math.max(0, (p.hiddenRating || 35) - ratingChange)
    }));

    return [...updatedTeam1, ...updatedTeam2];
};
