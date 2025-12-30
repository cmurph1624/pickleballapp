import { makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { auth, db, googleProvider } from '../firebase';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Only run the hook on Native platforms. 
    // On Web, this hook call is skipped entirely (safe because Platform.OS is constant per bundle).
    const [request, response, promptAsync] = Platform.OS === 'web'
        ? [null, null, null]
        : Google.useAuthRequest({
            iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
            androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
            // webClientId is not needed here as we don't run on web
            redirectUri: makeRedirectUri({
                scheme: 'pickleballapp'
            }),
        });

    useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            const credential = GoogleAuthProvider.credential(id_token);
            signInWithCredential(auth, credential)
                .catch((error) => console.error("Firebase Sign-In Error:", error));
        }
    }, [response]);

    const login = async () => {
        if (Platform.OS === 'web') {
            try {
                await signInWithPopup(auth, googleProvider);
            } catch (error) {
                console.error("Web Login Error:", error);
                alert("Login failed: " + error.message);
            }
        } else {
            if (request) {
                await promptAsync();
            } else {
                console.warn("Google Auth Request not ready yet.");
            }
        }
    };

    const logout = () => {
        return signOut(auth);
    };

    useEffect(() => {
        let unsubscribeSnapshot = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }

            if (user) {
                const userDocRef = doc(db, 'users', user.uid);

                try {
                    const userDocSnap = await getDoc(userDocRef);
                    if (!userDocSnap.exists()) {
                        const newUser = {
                            email: user.email ? user.email.toLowerCase() : null,
                            isAdmin: false,
                            walletBalance: 500,
                            hiddenRating: 50,
                            createdAt: new Date()
                        };
                        await setDoc(userDocRef, newUser);
                    } else {
                        const updates = {};
                        const userData = userDocSnap.data();

                        if (userData.walletBalance === undefined) {
                            updates.walletBalance = 500;
                        }

                        const currentEmailLower = user.email ? user.email.toLowerCase() : null;
                        if (currentEmailLower && (!userData.email || userData.email !== currentEmailLower)) {
                            updates.email = currentEmailLower;
                        }

                        if (Object.keys(updates).length > 0) {
                            await setDoc(userDocRef, updates, { merge: true });
                        }
                    }

                    unsubscribeSnapshot = onSnapshot(userDocRef, (doc) => {
                        if (doc.exists()) {
                            setCurrentUser({ ...user, ...doc.data() });
                        }
                        setLoading(false);
                    });
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    setLoading(false);
                }
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
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
