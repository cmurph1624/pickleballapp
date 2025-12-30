/**
 * Oddsmaker Service
 * Responsible for calculating spreads for matches based on player ratings.
 */

export const calculateSpread = (team1Players, team2Players) => {
    // Default to 0 spread if data is missing
    if (!team1Players || !team2Players || team1Players.length === 0 || team2Players.length === 0) {
        return { spread: 0, favoriteTeam: null };
    }

    // Calculate Average Rating for Team 1
    const team1Total = team1Players.reduce((sum, p) => sum + (p.hiddenRating || 35), 0);
    const team1Avg = team1Total / team1Players.length;

    // Calculate Average Rating for Team 2
    const team2Total = team2Players.reduce((sum, p) => sum + (p.hiddenRating || 35), 0);
    const team2Avg = team2Total / team2Players.length;

    const diff = team1Avg - team2Avg;

    // Scaling Factor: How many rating points equal 1 game point?
    // Let's assume 5 rating points = 1 game point spread for now.
    const SCALING_FACTOR = 0.2;

    let spread = Math.abs(diff * SCALING_FACTOR);

    // Round to nearest 0.5 to avoid ties if desired, or keep decimal
    spread = Math.round(spread * 2) / 2;

    let favoriteTeam = null;
    if (diff > 0) {
        favoriteTeam = 1; // Team 1 is favored
    } else if (diff < 0) {
        favoriteTeam = 2; // Team 2 is favored
    }

    return {
        spread, // Always positive number
        favoriteTeam // 1 or 2, or null if even
    };
};
