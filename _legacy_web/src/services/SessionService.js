import { db } from '../firebase';
import { doc, updateDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updateRatings } from './RatingEngine';
import { resolveBetsForMatch, refundBetsForMatch } from './BettingService';

/**
 * Completes a session by:
 * 1. Calculating and updating player ratings based on scored matches.
 * 2. Resolving bets for scored matches (Win/Loss).
 * 3. Refunding bets for unplayed matches.
 * 4. Marking the session as COMPLETED.
 * 
 * @param {string} sessionId - ID of the session to complete.
 * @returns {Promise<void>}
 */
export const completeSession = async (sessionId) => {
    console.log(`Starting completion for session ${sessionId}`);

    try {
        // 1. Fetch Session Data
        const sessionDoc = await getDoc(doc(db, 'sessions', sessionId));
        if (!sessionDoc.exists()) throw new Error("Session not found");
        const session = { id: sessionDoc.id, ...sessionDoc.data() };
        const matches = session.matches || [];

        if (session.status === 'COMPLETED') {
            console.warn("Session already completed.");
            return;
        }

        // 2. Fetch Players Involved
        const playerIds = new Set();
        matches.forEach(m => {
            m.team1.forEach(id => playerIds.add(id));
            m.team2.forEach(id => playerIds.add(id));
        });

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

        // 5. Mark Session as Completed
        await updateDoc(doc(db, 'sessions', sessionId), {
            status: 'COMPLETED'
        });

        console.log("Session completed successfully.");
        return currentPlayers; // Return updated players if needed by UI

    } catch (error) {
        console.error("Error in completeSession service:", error);
        throw error;
    }
};
