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
        <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0, backgroundColor: '#0f172a', height: '100%' }}>
            <SafeAreaView className="bg-slate-900 pt-8 pb-4 px-4 mb-2" edges={['top']}>
                <View className="flex-row items-center gap-3">
                    <View className="rounded-full border-2 border-slate-700 p-0.5">
                        <Avatar.Text
                            size={48}
                            label={(currentUser?.displayName || currentUser?.email || "U")[0].toUpperCase()}
                            style={{ backgroundColor: '#3b82f6' }}
                            labelStyle={{ color: 'white', fontWeight: 'bold' }}
                        />
                    </View>
                    <View>
                        <Text className="text-white font-bold text-lg">
                            {currentUser?.displayName?.split(' ')[0] || currentUser?.email?.split('@')[0]}
                        </Text>
                        <Text className="text-slate-400 text-xs">
                            Pickleball League
                        </Text>
                    </View>
                </View>
            </SafeAreaView>

            <View className="flex-1 bg-slate-900 px-2">
                <DrawerItem
                    label="Dashboard"
                    labelStyle={{ color: 'white', fontWeight: pathname === '/dashboard' ? 'bold' : 'normal' }}
                    icon={({ color, size }) => <List.Icon icon="view-dashboard" color={pathname === '/dashboard' ? '#60a5fa' : '#94a3b8'} />}
                    focused={pathname === '/dashboard'}
                    activeBackgroundColor="#1e293b"
                    onPress={() => router.push('/(drawer)/dashboard')}
                    style={{ borderRadius: 12 }}
                />

                <Divider className="my-2 bg-slate-800" />
                <Text className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">My Clubs</Text>

                {myClubs.map(club => (
                    <List.Accordion
                        key={club.id}
                        title={club.name}
                        titleStyle={{ color: 'white' }}
                        style={{ backgroundColor: 'transparent' }}
                        expanded={expandedClubId === club.id}
                        onPress={() => setExpandedClubId(expandedClubId === club.id ? null : club.id)}
                        left={props => <List.Icon {...props} color="#94a3b8" icon="shield-account" />}
                        right={props => <List.Icon {...props} color="#64748b" icon={expandedClubId === club.id ? "chevron-up" : "chevron-down"} />}
                    >
                        <View className="bg-slate-800/50 rounded-xl overflow-hidden mb-1 mx-2">
                            <List.Item
                                title="Leagues"
                                titleStyle={{ color: '#cbd5e1', fontSize: 14 }}
                                left={props => <List.Icon {...props} color="#94a3b8" icon="trophy" style={{ margin: 0 }} />}
                                onPress={() => router.push({ pathname: '/(drawer)/leagues', params: { clubId: club.id } })}
                                style={{ paddingVertical: 4 }}
                            />
                            <List.Item
                                title="Players"
                                titleStyle={{ color: '#cbd5e1', fontSize: 14 }}
                                left={props => <List.Icon {...props} color="#94a3b8" icon="account-group" style={{ margin: 0 }} />}
                                onPress={() => router.push({ pathname: '/(drawer)/players', params: { clubId: club.id } })}
                                style={{ paddingVertical: 4 }}
                            />
                            <List.Item
                                title="High Rollers"
                                titleStyle={{ color: '#cbd5e1', fontSize: 14 }}
                                left={props => <List.Icon {...props} color="#94a3b8" icon="currency-usd" style={{ margin: 0 }} />}
                                onPress={() => router.push({ pathname: '/(drawer)/high-rollers', params: { clubId: club.id } })}
                                style={{ paddingVertical: 4 }}
                            />
                            {/* <List.Item
                                title="Calendar"
                                titleStyle={{ color: '#cbd5e1', fontSize: 14 }}
                                left={props => <List.Icon {...props} color="#94a3b8" icon="calendar" style={{ margin: 0 }} />}
                                onPress={() => router.push({ pathname: '/(drawer)/schedule', params: { clubId: club.id } })}
                                style={{ paddingVertical: 4 }}
                            /> */}
                        </View>
                    </List.Accordion>
                ))}

                <Divider className="my-2 bg-slate-800" />

                <DrawerItem
                    label="Logout"
                    labelStyle={{ color: '#ef4444' }}
                    icon={({ color, size }) => <List.Icon icon="logout" color="#ef4444" />}
                    onPress={handleLogout}
                    style={{ borderRadius: 12 }}
                />
            </View>
        </DrawerContentScrollView>
    );
}
