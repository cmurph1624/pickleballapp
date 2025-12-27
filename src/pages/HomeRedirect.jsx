import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import ClubDashboard from './ClubDashboard';
import UserDashboard from './UserDashboard';
import ClaimPlayer from './ClaimPlayer';
import Layout from '../components/Layout';

const HomeRedirect = () => {
    const { currentUser } = useAuth();
    const [checkingLink, setCheckingLink] = useState(true);
    const [isLinked, setIsLinked] = useState(false);

    useEffect(() => {
        const checkPlayerLink = async () => {
            if (!currentUser) {
                setCheckingLink(false);
                return;
            }

            try {
                const playersRef = collection(db, 'players');
                // Query for a player document where linkedUserId matches current user
                const q = query(playersRef, where('linkedUserId', '==', currentUser.uid), limit(1));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    setIsLinked(true);
                } else {
                    setIsLinked(false);
                }
            } catch (error) {
                console.error("Error checking player link:", error);
                // Fallback to not linked to be safe, or handle error
            } finally {
                setCheckingLink(false);
            }
        };

        checkPlayerLink();
    }, [currentUser]);

    if (checkingLink && currentUser) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-white dark:bg-gray-900">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
        );
    }

    // If logged in
    if (currentUser) {
        // If linked, go to Dashboard
        if (isLinked) {
            return <UserDashboard />;
        }
        // If not linked, go to Claim Player screen
        return <ClaimPlayer />;
    }

    // If not logged in, show the generic landing / club selector
    return (
        <Layout>
            <ClubDashboard />
        </Layout>
    );
};

export default HomeRedirect;
