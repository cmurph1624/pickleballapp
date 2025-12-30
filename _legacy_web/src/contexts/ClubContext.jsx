import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const ClubContext = createContext();

export const useClub = () => useContext(ClubContext);

export const ClubProvider = ({ children }) => {
    // FIX: The route param is named :clubId in App.jsx, not :id
    const { clubId } = useParams();
    // Let's assume we use a Layout that extracts params or pass it in.

    // Better approach: The Context Provider will likely be rendered IN the ClubLayout, which has access to params.

    return (
        <ClubContextContent clubId={clubId}>
            {children}
        </ClubContextContent>
    );
};

// Separated to allow `useParams` to work if Provider is inside the Route path
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

        const docRef = doc(db, 'clubs', clubId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const clubData = { id: docSnap.id, ...docSnap.data() };
                setActiveClub(clubData);

                if (currentUser) {
                    const admins = clubData.admins || [];
                    // Check specific Club Admin list OR legacy global admin (to bootstrap)
                    const isClubAdmin = admins.includes(currentUser.uid) || (currentUser.isAdmin === true);
                    const members = clubData.members || [];

                    setIsAdmin(isClubAdmin);
                    setIsMember(members.includes(currentUser.uid) || isClubAdmin);
                }
            } else {
                setActiveClub(null);
                // Maybe handle 404
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
