import { DrawerContentScrollView, DrawerItem } from '@react-navigation/drawer';
import { usePathname, useRouter } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Avatar, Divider, List, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';

export default function CustomDrawerContent(props: any) {
    const { currentUser, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const theme = useTheme();
    const [myClubs, setMyClubs] = useState<any[]>([]);
    const [expandedClubId, setExpandedClubId] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(collection(db, 'clubs'), where('members', 'array-contains', currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const clubsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMyClubs(clubsData);
            if (clubsData.length > 0 && !expandedClubId) {
                setExpandedClubId(clubsData[0].id);
            }
        });

        return () => unsubscribe();
    }, [currentUser]);

    const handleLogout = async () => {
        try {
            await logout();
            router.replace('/');
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    return (
        <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
            <SafeAreaView className="bg-slate-800 pt-8 pb-4 px-4 mb-2" edges={['top']}>
                <View className="flex-row items-center gap-3">
                    <Avatar.Text
                        size={48}
                        label={currentUser?.email?.[0].toUpperCase() || "U"}
                        className="bg-primary"
                    />
                    <View>
                        <Text className="text-white font-bold text-lg">
                            {currentUser?.email?.split('@')[0]}
                        </Text>
                        <Text className="text-gray-400 text-xs">
                            Pickleball League
                        </Text>
                    </View>
                </View>
            </SafeAreaView>

            <DrawerItem
                label="Dashboard"
                icon={({ color, size }) => <List.Icon icon="view-dashboard" color={color} />}
                focused={pathname === '/dashboard'}
                onPress={() => router.push('/(drawer)/dashboard')}
            />

            <Divider className="my-2" />
            <Text className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">My Clubs</Text>

            {myClubs.map(club => (
                <List.Accordion
                    key={club.id}
                    title={club.name}
                    expanded={expandedClubId === club.id}
                    onPress={() => setExpandedClubId(expandedClubId === club.id ? null : club.id)}
                    left={props => <List.Icon {...props} icon="shield-account" />}
                >
                    <List.Item
                        title="Leagues"
                        left={props => <List.Icon {...props} icon="trophy" />}
                        onPress={() => router.push({ pathname: '/(drawer)/leagues', params: { clubId: club.id } })}
                    />
                    <List.Item
                        title="Players"
                        left={props => <List.Icon {...props} icon="account-group" />}
                        onPress={() => router.push({ pathname: '/(drawer)/players', params: { clubId: club.id } })}
                    />
                    <List.Item
                        title="High Rollers"
                        left={props => <List.Icon {...props} icon="currency-usd" />}
                        onPress={() => router.push({ pathname: '/(drawer)/high-rollers', params: { clubId: club.id } })}
                    />
                    <List.Item
                        title="Calendar"
                        left={props => <List.Icon {...props} icon="calendar" />}
                        onPress={() => router.push({ pathname: '/(drawer)/schedule', params: { clubId: club.id } })}
                    />
                </List.Accordion>
            ))}

            <Divider className="my-2" />

            <DrawerItem
                label="Logout"
                icon={({ color, size }) => <List.Icon icon="logout" color={color} />}
                onPress={handleLogout}
            />
        </DrawerContentScrollView>
    );
}
