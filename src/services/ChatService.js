import { db } from '../firebase';
import {
    collection,
    query,
    where,
    addDoc,
    serverTimestamp,
    orderBy,
    onSnapshot,
    limit
} from 'firebase/firestore';

/**
 * Subscribes to channels where the user is a member.
 * @param {string} userId 
 * @param {function} callback 
 * @returns {function} unsubscribe
 */
export const subscribeToChannels = (userId, callback) => {
    if (!userId) return () => { };

    const q = query(
        collection(db, 'channels'),
        where('allowedUserIds', 'array-contains', userId)
        // We can order by lastUpdated desc if we add that field later
    );

    return onSnapshot(q, (snapshot) => {
        const channels = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(channels);
    });
};

/**
 * Subscribes to messages in a specific channel.
 * @param {string} channelId 
 * @param {function} callback 
 * @returns {function} unsubscribe
 */
export const subscribeToMessages = (channelId, callback) => {
    if (!channelId) return () => { };

    const q = query(
        collection(db, 'channels', channelId, 'messages'),
        orderBy('timestamp', 'asc'),
        limit(100) // Limit to last 100 messages for now
    );

    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(messages);
    });
};

/**
 * Sends a message to a channel.
 * @param {string} channelId 
 * @param {string} userId 
 * @param {string} userName 
 * @param {string} content 
 */
export const sendMessage = async (channelId, userId, userName, content) => {
    if (!content.trim()) return;

    await addDoc(collection(db, 'channels', channelId, 'messages'), {
        senderId: userId,
        senderName: userName,
        content: content,
        timestamp: serverTimestamp()
    });
};

/**
 * Creates a DM channel between two users.
 * (Note: Check if exists first is better, but for MVP we might just create/open)
 */
/**
 * Creates or opens a DM channel between two users.
 * Uses a composite key 'dm_{uid1}_{uid2}' (sorted) to ensure uniqueness.
 */
import { setDoc, doc } from 'firebase/firestore'; // Ensure these are imported at the top

export const createDMChannel = async (currentUserId, otherUserId, otherUserName) => {
    if (!currentUserId || !otherUserId) return null;

    const uids = [currentUserId, otherUserId].sort();
    const channelId = `dm_${uids[0]}_${uids[1]}`;
    const channelRef = doc(db, 'channels', channelId);

    // We use setDoc with merge: true. 
    // This allows us to "create if not exists" or "update if exists" (though we only want to ensure it exists).
    // The security rules must allow 'create' for this ID pattern and 'update' if we are in allowedUserIds.
    // However, our rules say 'allow update: false'. 
    // BUT 'set' counts as a 'create' if the document doesn't exist? 
    // Actually, 'set' with merge might trigger 'update' rule if doc exists.
    // If doc exists, we don't strictly *need* to write anything, just return ID.
    // So let's try to read it first? Or just try to write and ignore error if it says permission denied on update?

    // Better: Read first.
    try {
        const docSnap = await import('firebase/firestore').then(mod => mod.getDoc(channelRef));

        if (!docSnap.exists()) {
            // Create it
            await setDoc(channelRef, {
                type: 'dm',
                allowedUserIds: uids,
                // Metadata for DMs is tricky because "Name" depends on who is viewing it.
                // We can store a 'names' map? or just no name and let UI resolve it?
                // Let's store map: { [uid]: name }
                metadata: {
                    isDM: true
                },
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }

        return channelId;
    } catch (e) {
        console.error("Error creating/opening DM:", e);
        throw e;
    }
};
