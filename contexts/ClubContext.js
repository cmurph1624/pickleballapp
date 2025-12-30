import { useGlobalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const ClubContext = createContext();

export const useClub = () => useContext(ClubContext);

export const ClubProvider = ({ children }) => {
    // In Expo Router, params can be accessed globally or via local hooks.
    // Assuming clubId is a path parameter or search parameter.
    const { clubId } = useGlobalSearchParams();

    return (
        <ClubContextContent clubId={clubId}>
            {children}
        </ClubContextContent>
    );
};

const ClubContextContent = ({ children, clubId }) => {
    const { currentUser } = useAuth();
    const [activeClub, setActiveClub] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isMember, setIsMember] = useState(false);

    useEffect(() => {
        if (!clubId) {
            setActiveClub(null);
            setLoading(false);
            return;
        }

        // Handle array of strings if clubId is from catch-all route
        const id = Array.isArray(clubId) ? clubId[0] : clubId;

        const docRef = doc(db, 'clubs', id);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const clubData = { id: docSnap.id, ...docSnap.data() };
                setActiveClub(clubData);

                if (currentUser) {
                    const admins = clubData.admins || [];
                    const isClubAdmin = admins.includes(currentUser.uid) || (currentUser.isAdmin === true);
                    const members = clubData.members || [];

                    setIsAdmin(isClubAdmin);
                    setIsMember(members.includes(currentUser.uid) || isClubAdmin);
                }
            } else {
                setActiveClub(null);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching club", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [clubId, currentUser]);

    const value = {
        activeClub,
        loading,
        isAdmin,
        isMember,
        clubId
    };

    return (
        <ClubContext.Provider value={value}>
            {children}
        </ClubContext.Provider>
    );
};
