import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import ClubDashboard from './ClubDashboard';
import UserDashboard from './UserDashboard';
// Reusing ClubDashboard as the "No Club / Create Club" view, 
// but if user HAS clubs, we redirect.

import Layout from '../components/Layout';

const HomeRedirect = () => {
    const { currentUser } = useAuth();
    // If logged in, show User Dashboard (home base) - NEW DESIGN (No Layout Wrapper)
    if (currentUser) {
        return <UserDashboard />;
    }

    // If not logged in, show the generic landing / club selector - OLD DESIGN (Needs Layout)
    return (
        <Layout>
            <ClubDashboard />
        </Layout>
    );
};

export default HomeRedirect;
