import { db } from '../firebase';
import { collection, getDocs, setDoc, doc, deleteDoc } from 'firebase/firestore';

/**
 * Migrates data from 'weeks' collection to 'sessions' collection.
 * Usage: Import this function and call it (e.g. from the browser console or a temporary button).
 */
export const migrateWeeksToSessions = async () => {
    console.log("Starting migration from 'weeks' to 'sessions'...");
    try {
        const weeksRef = collection(db, 'weeks');
        const snapshot = await getDocs(weeksRef);

        if (snapshot.empty) {
            console.log("No documents in 'weeks' collection.");
            return;
        }

        console.log(`Found ${snapshot.size} documents to migrate.`);

        for (const docSnap of snapshot.docs) {
            const data = docSnap.data();
            const id = docSnap.id;

            // Write to sessions
            await setDoc(doc(db, 'sessions', id), data);
            console.log(`Migrated doc: ${id}`);

            // Optional: Delete from weeks after successful write
            // Uncomment the line below to delete the old document
            // await deleteDoc(doc(db, 'weeks', id));
        }

        console.log("Migration complete!");
    } catch (error) {
        console.error("Migration failed:", error);
    }
};
