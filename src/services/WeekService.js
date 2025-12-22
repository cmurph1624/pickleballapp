import { db } from '../firebase';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updateRatings } from './RatingEngine';
import { resolveBetsForMatch, refundBetsForMatch } from './BettingService';

/**
 * Completes a week by:
 * 1. Calculating and updating player ratings based on scored matches.
 * 2. Resolving bets for scored matches (Win/Loss).
 * 3. Refunding bets for unplayed matches.
 * 4. Marking the week as COMPLETED.
 * 
 * @param {string} weekId - ID of the week to complete.
 * @returns {Promise<void>}
 */
export const completeWeek = async (weekId) => {
    console.log(`Starting completion for week ${weekId}`);

    try {
        // 1. Fetch Week Data
        const weekDoc = await getDoc(doc(db, 'weeks', weekId));
        if (!weekDoc.exists()) throw new Error("Week not found");
        const week = { id: weekDoc.id, ...weekDoc.data() };
        const matches = week.matches || [];

        if (week.status === 'COMPLETED') {
            console.warn("Week already completed.");
            return;
        }

        // 2. Fetch Players Involved
        // We need all players to update their ratings correctly.
        // Similar to WeekDetails, we fetch all players for simplicity or filter if possible.
        // Optimization: Fetch only ID's needed.
        const playerIds = new Set();
        matches.forEach(m => {
            m.team1.forEach(id => playerIds.add(id));
            m.team2.forEach(id => playerIds.add(id));
        });

        // Batch fetching players might be cleaner if we had a helper, 
        // but for now let's query all players and filter, matching existing pattern for consistency
        // or query 'where documentId in [...]' chunks.
        // Let's stick to the pattern used in WeekDetails for safety: fetch 'all' players collection if small, or query.
        // Given complexity, let's just fetch all players (assuming < 100s for now).
        const playersSnap = await getDocs(collection(db, 'players'));
        let currentPlayers = playersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Filter to only involved players
        currentPlayers = currentPlayers.filter(p => playerIds.has(p.id));


        // 3. Process Matches (Ratings & Bets)
        const scoredMatches = matches.filter(m => m.team1Score !== undefined && m.team2Score !== undefined);
        const unplayedMatches = matches.filter(m => m.team1Score === undefined || m.team2Score === undefined);

        // 3a. Rating Updates (Sequential)
        for (const match of scoredMatches) {
            const team1Players = currentPlayers.filter(p => match.team1.includes(p.id));
            const team2Players = currentPlayers.filter(p => match.team2.includes(p.id));

            // Get updated player objects
            const updatedPlayerStats = updateRatings(match, team1Players, team2Players);

            // Merge updates back into currentPlayers array
            currentPlayers = currentPlayers.map(p => {
                const updated = updatedPlayerStats.find(u => u.id === p.id);
                return updated ? updated : p;
            });
        }

        // 3b. Batch Update Ratings in Firestore
        const ratingUpdates = currentPlayers.map(p =>
            updateDoc(doc(db, 'players', p.id), { hiddenRating: p.hiddenRating })
        );
        await Promise.all(ratingUpdates);
        console.log("Updated ratings for players.");


        // 4. Resolve Bets (Scored -> Resolve, Unplayed -> Refund)
        const resolvePromises = scoredMatches.map(m =>
            resolveBetsForMatch(m.id, m.team1Score, m.team2Score, m)
        );
        const refundPromises = unplayedMatches.map(m =>
            refundBetsForMatch(m.id)
        );

        await Promise.all([...resolvePromises, ...refundPromises]);
        console.log("Resolved and refunded bets.");


        // 5. Mark Week as Completed
        await updateDoc(doc(db, 'weeks', weekId), {
            status: 'COMPLETED'
        });

        console.log("Week completed successfully.");
        return currentPlayers; // Return updated players if needed by UI

    } catch (error) {
        console.error("Error in completeWeek service:", error);
        throw error;
    }
};
