import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyC3lrm_BdW7-SlQyPaf6Yrnogm867fleVU",
    authDomain: "pickleball-268d5.firebaseapp.com",
    projectId: "pickleball-268d5",
    storageBucket: "pickleball-268d5.firebasestorage.app",
    messagingSenderId: "323222852358",
    appId: "1:323222852358:web:bbf762c7d6df0057340487",
    measurementId: "G-WNVV13W3C9"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
