import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Completes a session by calling the Cloud Function.
 * The function handles rating updates, bet resolution, and marking the session complete.
 * 
 * @param {string} sessionId 
 * @returns {Promise<void>}
 */
export const completeSession = async (sessionId) => {
    console.log(`Requesting completion for session ${sessionId} via Cloud Function`);
    const functions = getFunctions();
    const completeSessionFn = httpsCallable(functions, 'complete_session');

    try {
        const result = await completeSessionFn({ sessionId });
        if (result.data.error) throw new Error(result.data.error);

        console.log("Session completed successfully.");
        // Note: We rely on Firestore listeners in the UI to update the state/players
        return null;
    } catch (error) {
        console.error("Error completing session:", error);
        throw error;
    }
};

/**
 * Substitutes a player via Cloud Function.
 * Handles bet settlement (forfeit/refund) automatically.
 * 
 * @param {string} sessionId 
 * @param {string} oldPlayerId 
 * @param {string} newPlayerId 
 */
export const substitutePlayer = async (sessionId, oldPlayerId, newPlayerId) => {
    console.log(`Requesting substitution ${oldPlayerId} -> ${newPlayerId}`);
    const functions = getFunctions();
    const substitutePlayerFn = httpsCallable(functions, 'substitute_player');

    try {
        const result = await substitutePlayerFn({ sessionId, oldPlayerId, newPlayerId });
        if (result.data.error) throw new Error(result.data.error);

        console.log("Substitution complete.");
        return null; // UI listeners will update
    } catch (error) {
        console.error("Error substituting player:", error);
        throw error;
    }
};

/**
 * Joins a session via Cloud Function.
 * Handles waitlisting and club membership checks.
 * 
 * @param {string} sessionId 
 * @param {string} playerId 
 * @returns {Promise<string>} - "JOINED" or "WAITLISTED"
 */
export const joinSession = async (sessionId, playerId) => {
    const functions = getFunctions();
    const joinSessionFn = httpsCallable(functions, 'join_session');

    try {
        const result = await joinSessionFn({ sessionId, playerId });

        if (result.data.error) throw new Error(result.data.error);

        return result.data.status; // "JOINED" or "WAITLISTED"
    } catch (error) {
        console.error("Error joining session:", error);
        throw error;
    }
};

/**
 * Leaves a session via Cloud Function.
 * Handles promotion from waitlist.
 * 
 * @param {string} sessionId 
 * @param {string} playerId 
 */
export const leaveSession = async (sessionId, playerId) => {
    const functions = getFunctions();
    const leaveSessionFn = httpsCallable(functions, 'leave_session');

    try {
        const result = await leaveSessionFn({ sessionId, playerId });
        if (result.data.error) throw new Error(result.data.error);

        return true;
    } catch (error) {
        console.error("Error leaving session:", error);
        throw error;
    }
};
