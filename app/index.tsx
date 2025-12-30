import { Redirect } from 'expo-router';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';

export default function LandingScreen() {
    const { currentUser, login, loading: authLoading } = useAuth();
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
                const q = query(playersRef, where('linkedUserId', '==', currentUser.uid), limit(1));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    setIsLinked(true);
                } else {
                    setIsLinked(false);
                }
            } catch (error) {
                console.error("Error checking player link:", error);
            } finally {
                setCheckingLink(false);
            }
        };

        if (!authLoading) {
            checkPlayerLink();
        }
    }, [currentUser, authLoading]);

    if (authLoading || (currentUser && checkingLink)) {
        return (
            <View className="flex-1 justify-center items-center bg-white dark:bg-slate-900">
                <ActivityIndicator size="large" color="#0000ff" />
            </View>
        );
    }

    if (currentUser) {
        if (isLinked) {
            return <Redirect href="/(drawer)/dashboard" />;
        }
        // Redirect to claim player (placeholder for now, or just go to dashboard)
        // For now, redirect to dashboard as fallback or create a claim page
        return <Redirect href="/(drawer)/dashboard" />;
    }

    return (
        <SafeAreaView className="flex-1 justify-center items-center bg-white dark:bg-slate-900 p-4">
            <Text variant="headlineMedium" className="mb-8 font-bold text-center">
                Pickleball League
            </Text>

            <Text className="mb-4 text-center text-gray-600">
                Welcome! Please sign in to continue.
            </Text>

            <Button
                mode="contained"
                onPress={login}
                className="w-full max-w-sm"
            >
                Sign In with Google
            </Button>
        </SafeAreaView>
    );
}
