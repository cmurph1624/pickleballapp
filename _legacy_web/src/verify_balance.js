import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase.js';

const verifyBalance = async () => {
    console.log("Verifying User Balances...");
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        querySnapshot.forEach((doc) => {
            console.log(`User ID: ${doc.id}`);
            console.log(`Email: ${doc.data().email}`);
            console.log(`Wallet Balance: ${doc.data().walletBalance}`);
            console.log("-------------------");
        });
    } catch (error) {
        console.error("Error fetching users:", error);
    }
    process.exit(0);
};

verifyBalance();
