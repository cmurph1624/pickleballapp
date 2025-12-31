import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const login = () => {
        return signInWithPopup(auth, googleProvider);
    };

    const logout = () => {
        return signOut(auth);
    };

    useEffect(() => {
        let unsubscribeSnapshot = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            // Unsubscribe from previous snapshot listener if exists
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }

            if (user) {
                const userDocRef = doc(db, 'users', user.uid);

                // Check if user exists first to handle creation
                const userDocSnap = await getDoc(userDocRef);
                if (!userDocSnap.exists()) {
                    const newUser = {
                        email: user.email ? user.email.toLowerCase() : null,
                        isAdmin: false,
                        walletBalance: 500,
                        hiddenRating: 50,
                        createdAt: new Date(),
                        displayName: user.displayName || '',
                        firstName: user.displayName ? user.displayName.split(' ')[0] : '',
                        lastName: user.displayName && user.displayName.split(' ').length > 1 ? user.displayName.split(' ').slice(1).join(' ') : ''
                    };
                    await setDoc(userDocRef, newUser);
                } else {
                    // Backfill walletBalance AND ensure email is up to date (and lowercase)
                    const updates = {};
                    const userData = userDocSnap.data();

                    if (userData.walletBalance === undefined) {
                        updates.walletBalance = 500;
                    }

                    // If email is missing OR if it has uppercase letters, update it
                    const currentEmailLower = user.email ? user.email.toLowerCase() : null;
                    if (currentEmailLower && (!userData.email || userData.email !== currentEmailLower)) {
                        updates.email = currentEmailLower;
                    }

                    // Update Name fields if missing or changed
                    if (user.displayName) {
                        if (userData.displayName !== user.displayName) {
                            updates.displayName = user.displayName;
                        }

                        const nameParts = user.displayName.split(' ');
                        const newFirst = nameParts[0];
                        const newLast = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

                        if (!userData.firstName) updates.firstName = newFirst;
                        if (!userData.lastName) updates.lastName = newLast;
                    }

                    if (Object.keys(updates).length > 0) {
                        await setDoc(userDocRef, updates, { merge: true });
                    }
                }

                // Set up real-time listener
                unsubscribeSnapshot = onSnapshot(userDocRef, (doc) => {
                    if (doc.exists()) {
                        setCurrentUser({ ...user, ...doc.data() });
                    }
                    setLoading(false);
                });
            } else {
                setCurrentUser(null);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeSnapshot) unsubscribeSnapshot();
        };
    }, []);

    const value = {
        currentUser,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
