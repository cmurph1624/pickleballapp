/**
 * Pure function to calculate bet outcome.
 * @param {object} bet - { teamPicked, spreadAtTimeOfBet, favoriteTeamAtTimeOfBet }
 * @param {number} team1Score
 * @param {number} team2Score
 * @returns {string} 'WON', 'LOST', or 'PUSH'
 */
export const calculateBetOutcome = (bet, team1Score, team2Score) => {
    let outcome = 'LOST';
    const spread = bet.spreadAtTimeOfBet;
    const favorite = bet.favoriteTeamAtTimeOfBet;

    let scoreDiff = 0;

    // Calculate raw score difference based on who is the favorite logic
    if (favorite === 1) {
        scoreDiff = team1Score - team2Score;
    } else if (favorite === 2) {
        scoreDiff = team2Score - team1Score;
    } else {
        // Pick 'em (Spread 0)
        // If user picked Team 1
        if (bet.teamPicked === 1) {
            scoreDiff = team1Score - team2Score;
        } else {
            scoreDiff = team2Score - team1Score;
        }
    }

    // Logic for Spread Betting
    if (spread === 0) {
        // Pick 'em logic
        if (scoreDiff > 0) outcome = 'WON';
        else if (scoreDiff < 0) outcome = 'LOST';
        else outcome = 'PUSH';
    } else {
        // Spread logic
        const userPickedFavorite = (bet.teamPicked === favorite);

        if (userPickedFavorite) {
            // Must win by MORE than spread
            if (scoreDiff > spread) outcome = 'WON';
            else if (scoreDiff === spread) outcome = 'PUSH';
            else outcome = 'LOST';
        } else {
            // User picked Underdog
            // Covers if Favorite wins by LESS than spread, or Favorite loses (scoreDiff < 0)
            if (scoreDiff < spread) outcome = 'WON';
            else if (scoreDiff === spread) outcome = 'PUSH';
            else outcome = 'LOST'; // Favorite covered
        }
    }
    return outcome;
};
