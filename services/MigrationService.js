import { collection, query, where, getDocs, addDoc, updateDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export const migrateToClubArchitecture = async (currentUser) => {
    if (!currentUser) throw new Error("Must be logged in to migrate");

    console.log("Starting Migration...");

    // 1. Check if Default Club exists
    const clubName = "Picklr Early Morning";
    const clubsRef = collection(db, 'clubs');
    const q = query(clubsRef, where('name', '==', clubName));
    const clubSnap = await getDocs(q);

    let clubId;

    if (!clubSnap.empty) {
        console.log("Default club already exists.");
        clubId = clubSnap.docs[0].id;
    } else {
        console.log("Creating default club...");
        const newClub = {
            name: clubName,
            admins: [currentUser.uid],
            members: [currentUser.uid],
            createdAt: new Date(),
            createdBy: currentUser.uid
        };
        const docRef = await addDoc(clubsRef, newClub);
        clubId = docRef.id;
        console.log("Created club with ID:", clubId);
    }

    // 2. Update existing Leagues
    console.log("Backfilling Leagues...");
    const leaguesRef = collection(db, 'leagues');
    // Fetch all leagues that don't have a clubId (if possible to query for missing field, tricky in firestore)
    // Just fetch all and update if missing
    const leaguesSnap = await getDocs(leaguesRef);

    const updates = [];
    leaguesSnap.forEach((leagueDoc) => {
        const data = leagueDoc.data();
        if (!data.clubId) {
            updates.push(updateDoc(doc(db, 'leagues', leagueDoc.id), { clubId: clubId }));
        }
    });

    await Promise.all(updates);
    console.log(`Updated ${updates.length} leagues.`);

    return clubId;
};
