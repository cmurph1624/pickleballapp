import { collection, query, where, getDocs, doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Resolves all OPEN bets for a specific match based on the final score.
 * @param {string} matchId - The ID of the match.
 * @param {number} team1Score - Score of Team 1.
 * @param {number} team2Score - Score of Team 2.
 * @param {object} matchData - The match object containing spread and favorite info.
 */
export const resolveBetsForMatch = async (matchId, team1Score, team2Score, matchData) => {
    console.log(`Resolving bets for match ${matchId} (Score: ${team1Score}-${team2Score})`);

    try {
        // 1. Get all OPEN bets for this match
        // Note: We query by matchId. If matchId is not unique/stable, this could be an issue, 
        // but we are assuming it is passed correctly from the UI context.
        const betsQuery = query(
            collection(db, 'bets'),
            where('matchId', '==', matchId),
            where('status', '==', 'OPEN')
        );
        const betsSnapshot = await getDocs(betsQuery);

        if (betsSnapshot.empty) {
            console.log("No open bets found for this match.");
            return;
        }

        console.log(`Found ${betsSnapshot.size} open bets to resolve.`);

        // 2. Process each bet
        const promises = betsSnapshot.docs.map(async (betDoc) => {
            const bet = betDoc.data();
            const betId = betDoc.id;

            // Determine the outcome
            let outcome = 'LOST';
            let payout = 0;

            // Calculate margin of victory for the favorite
            // Spread is always positive in our system (e.g., 2.5)
            // FavoriteTeam is 1 or 2

            const spread = bet.spreadAtTimeOfBet;
            const favorite = bet.favoriteTeamAtTimeOfBet;

            let scoreDiff = 0;
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
                else outcome = 'PUSH'; // Tie game (unlikely in pickleball usually, but possible in some formats)
            } else {
                // Spread logic
                // If I bet on Favorite: Favorite must win by MORE than spread
                // If I bet on Underdog: Underdog must win OR lose by LESS than spread

                const userPickedFavorite = (bet.teamPicked === favorite);

                if (userPickedFavorite) {
                    if (scoreDiff > spread) outcome = 'WON';
                    else if (scoreDiff === spread) outcome = 'PUSH';
                    else outcome = 'LOST';
                } else {
                    // User picked Underdog
                    // Underdog covers if Favorite wins by LESS than spread, or Favorite loses (scoreDiff < 0)
                    if (scoreDiff < spread) outcome = 'WON';
                    else if (scoreDiff === spread) outcome = 'PUSH';
                    else outcome = 'LOST';
                }
            }

            console.log(`Bet ${betId}: Picked ${bet.teamPicked}, Fav ${favorite}, Spread ${spread}, Diff ${scoreDiff} -> ${outcome}`);

            // 3. Execute Transaction for Payouts
            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', bet.userId);
                const betRef = doc(db, 'bets', betId);

                // Get fresh user data
                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw "User not found";

                const currentBalance = userDoc.data().walletBalance || 0;
                let newBalance = currentBalance;

                if (outcome === 'WON') {
                    // Payout: Stake + Profit (1:1) = 2 * Amount
                    payout = bet.amount * 2;
                    newBalance += payout;
                } else if (outcome === 'PUSH') {
                    // Refund Stake
                    payout = bet.amount;
                    newBalance += payout;
                }

                // Update User Balance
                if (outcome !== 'LOST') {
                    transaction.update(userRef, { walletBalance: newBalance });
                }

                // Update Bet Status
                transaction.update(betRef, {
                    status: outcome,
                    resolvedAt: new Date(),
                    payout: payout,
                    finalScore: `${team1Score}-${team2Score}`
                });
            });
        });

        await Promise.all(promises);
        console.log("All bets resolved.");

    } catch (error) {
        console.error("Error resolving bets:", error);
    }
};

/**
 * Refunds all OPEN bets for a specific match.
 * Used when a match is unplayed and the week is completed.
 * @param {string} matchId - The ID of the match.
 */
export const refundBetsForMatch = async (matchId) => {
    console.log(`Refunding bets for match ${matchId}`);

    try {
        const betsQuery = query(
            collection(db, 'bets'),
            where('matchId', '==', matchId),
            where('status', '==', 'OPEN')
        );
        const betsSnapshot = await getDocs(betsQuery);

        if (betsSnapshot.empty) {
            console.log("No open bets found to refund for match", matchId);
            return;
        }

        console.log(`Found ${betsSnapshot.size} bets to refund.`);

        const promises = betsSnapshot.docs.map(async (betDoc) => {
            const bet = betDoc.data();
            const betId = betDoc.id;

            await runTransaction(db, async (transaction) => {
                const userRef = doc(db, 'users', bet.userId);
                const betRef = doc(db, 'bets', betId);

                const userDoc = await transaction.get(userRef);
                if (!userDoc.exists()) throw "User not found";

                const currentBalance = userDoc.data().walletBalance || 0;
                const refundAmount = bet.amount;
                const newBalance = currentBalance + refundAmount;

                // Refund User
                transaction.update(userRef, { walletBalance: newBalance });

                // Mark Bet as Refunded
                transaction.update(betRef, {
                    status: 'REFUNDED',
                    resolvedAt: new Date(),
                    payout: refundAmount,
                    note: 'Match unplayed'
                });
            });
        });

        await Promise.all(promises);
        console.log("All bets refunded for match", matchId);

    } catch (error) {
        console.error("Error refunding bets:", error);
    }
};
