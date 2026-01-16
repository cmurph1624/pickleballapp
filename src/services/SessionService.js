import { db } from '../firebase';
import { doc, updateDoc, getDoc, collection, query, where, getDocs, runTransaction } from 'firebase/firestore';
import { updateRatings } from './RatingEngine';
import { resolveBetsForMatch, refundBetsForMatch, settleBetsForSubstitution } from './BettingService';

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

/**
 * Substitutes a player in an active session.
 * 1. Replaces player in Session.players list.
 * 2. Replaces player in all UNPLAYED matches.
 * 3. Settles bets for those matches (Loss/Refund).
 * 
 * @param {string} sessionId 
 * @param {string} oldPlayerId 
 * @param {string} newPlayerId 
 */
export const substitutePlayer = async (sessionId, oldPlayerId, newPlayerId) => {
    console.log(`Substituting player ${oldPlayerId} with ${newPlayerId} in session ${sessionId}`);

    try {
        const sessionRef = doc(db, 'sessions', sessionId);
        const sessionDoc = await getDoc(sessionRef);
        if (!sessionDoc.exists()) throw new Error("Session not found");

        const session = sessionDoc.data();
        const matches = session.matches || [];

        // 1. Identify Unplayed Matches involving Old Player
        const affectedMatches = matches.filter(m =>
            (m.team1.includes(oldPlayerId) || m.team2.includes(oldPlayerId)) &&
            (m.team1Score === undefined && m.team2Score === undefined)
        );

        console.log(`Found ${affectedMatches.length} affected matches.`);

        // 2. Settle Bets BEFORE modifying matches (so we know which team old player was on)
        if (affectedMatches.length > 0) {
            await settleBetsForSubstitution(affectedMatches, oldPlayerId);
        }

        // 3. Update Matches (Swap ID)
        const updatedMatches = matches.map(m => {
            // Only update if it's unplayed and has the player
            if ((m.team1Score === undefined && m.team2Score === undefined) &&
                (m.team1.includes(oldPlayerId) || m.team2.includes(oldPlayerId))) {

                const newTeam1 = m.team1.map(id => id === oldPlayerId ? newPlayerId : id);
                const newTeam2 = m.team2.map(id => id === oldPlayerId ? newPlayerId : id);

                return { ...m, team1: newTeam1, team2: newTeam2 };
            }
            return m;
        });

        // 4. Update Players List
        const updatedPlayersList = (session.players || []).filter(id => id !== oldPlayerId);
        if (!updatedPlayersList.includes(newPlayerId)) {
            updatedPlayersList.push(newPlayerId);
        }

        // 5. Save to Firestore
        await updateDoc(sessionRef, {
            players: updatedPlayersList,
            matches: updatedMatches
        });

        console.log("Substitution complete.");
        return updatedPlayersList;

    } catch (error) {
        console.error("Error in substitutePlayer:", error);
        throw error;
    }
};
/**
 * Allows a player to join a session.
 * Handles player limits and waitlisting automatically.
 * 
 * @param {string} sessionId 
 * @param {string} playerId 
 * @returns {Promise<string>} - Status message ("JOINED" or "WAITLISTED")
 */
export const joinSession = async (sessionId, playerId) => {
    try {
        return await runTransaction(db, async (transaction) => {
            const sessionRef = doc(db, 'sessions', sessionId);
            const sessionDoc = await transaction.get(sessionRef);

            if (!sessionDoc.exists()) {
                throw new Error("Session does not exist!");
            }

            const session = sessionDoc.data();

            // --- Club Membership Validation ---
            if (session.clubId) {
                const playerRef = doc(db, 'players', playerId);
                const playerDoc = await transaction.get(playerRef);
                if (!playerDoc.exists()) {
                    throw new Error("Player profile not found.");
                }

                const playerData = playerDoc.data();
                const linkedUserId = playerData.linkedUserId;

                if (!linkedUserId) {
                    throw new Error("Your player profile is not linked to a user account.");
                }

                const clubRef = doc(db, 'clubs', session.clubId);
                const clubDoc = await transaction.get(clubRef);

                if (!clubDoc.exists()) {
                    throw new Error("Club not found.");
                }

                const clubData = clubDoc.data();
                const members = clubData.members || [];

                if (!members.includes(linkedUserId)) {
                    throw new Error("You must be a member of this club to join its sessions.");
                }
            }

            const players = session.players || [];
            const waitlist = session.waitlist || [];
            const playerLimit = session.playerLimit || 0; // 0 means no limit (or huge limit)

            // Check if already joined
            if (players.includes(playerId)) {
                throw new Error("You have already joined this session.");
            }
            if (waitlist.includes(playerId)) {
                throw new Error("You are already on the waitlist.");
            }

            // Logic:
            // 1. If limit is set AND players count >= limit -> Add to Waitlist
            // 2. Else -> Add to Players

            if (playerLimit > 0 && players.length >= playerLimit) {
                // Add to Waitlist
                const newWaitlist = [...waitlist, playerId];
                transaction.update(sessionRef, { waitlist: newWaitlist });
                return "WAITLISTED";
            } else {
                // Add to Players
                const newPlayers = [...players, playerId];
                transaction.update(sessionRef, { players: newPlayers });
                return "JOINED";
            }
        });
    } catch (error) {
        console.error("Error joining session:", error);
        throw error;
    }
};

/**
 * Allows a player to leave a session.
 * Automatically promotes the next person on the waitlist if a spot opens up.
 * 
 * @param {string} sessionId 
 * @param {string} playerId 
 */
export const leaveSession = async (sessionId, playerId) => {
    try {
        await runTransaction(db, async (transaction) => {
            const sessionRef = doc(db, 'sessions', sessionId);
            const sessionDoc = await transaction.get(sessionRef);

            if (!sessionDoc.exists()) {
                throw new Error("Session does not exist!");
            }

            const session = sessionDoc.data();
            let players = session.players || [];
            let waitlist = session.waitlist || [];
            const playerLimit = session.playerLimit || 0;

            const wasInPlayers = players.includes(playerId);
            const wasInWaitlist = waitlist.includes(playerId);

            if (!wasInPlayers && !wasInWaitlist) {
                throw new Error("You are not part of this session.");
            }

            // Remove player
            if (wasInPlayers) {
                players = players.filter(id => id !== playerId);

                // Promote from waitlist if there is a limit and we dropped below it (which we did by leaving)
                // Actually, just check if waitlist has anyone.
                if (waitlist.length > 0) {
                    // Check limit just in case, but if they were in players, limit was likely met or not set.
                    // If limit is 0 (unlimited), waitlist shouldn't exist, but safe to promote if it does.
                    // If limit exists and we have space now...
                    if (players.length < playerLimit || playerLimit === 0) {
                        const promotedPlayerId = waitlist[0];
                        waitlist = waitlist.slice(1);
                        players.push(promotedPlayerId);

                        // Notify promoted user
                        const promotedPlayerRef = doc(db, 'players', promotedPlayerId);
                        transaction.get(promotedPlayerRef).then(playerSnap => {
                            if (playerSnap.exists()) {
                                const linkedUserId = playerSnap.data().linkedUserId;
                                if (linkedUserId) {
                                    const newNotifRef = doc(collection(db, 'notifications'));
                                    transaction.set(newNotifRef, {
                                        userId: linkedUserId,
                                        message: `You have been promoted from the waitlist for session ${session.date || ''} ${session.time || ''} at ${session.location || 'the club'}!`,
                                        type: 'success',
                                        read: false,
                                        timestamp: new Date().toISOString()
                                    });
                                }
                            }
                        }).catch(err => console.error("Error fetching player for notification", err));
                    }
                }
            } else {
                waitlist = waitlist.filter(id => id !== playerId);
            }

            transaction.update(sessionRef, {
                players: players,
                waitlist: waitlist
            });
        });
    } catch (error) {
        console.error("Error leaving session:", error);
        throw error;
    }
};
