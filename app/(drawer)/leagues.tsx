import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Avatar, FAB, IconButton, SegmentedButtons, Switch, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import LeagueModal from '../../components/LeagueModal';
import SessionModal from '../../components/SessionModal';
import { useAuth } from '../../contexts/AuthContext';
import { useClub } from '../../contexts/ClubContext';
import { db } from '../../firebase';

export default function LeaguesScreen() {
    const [leagues, setLeagues] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('leagues'); // 'leagues' | 'sessions'
    const [showActiveOnly, setShowActiveOnly] = useState(true);

    // Modal State
    const [leagueModalVisible, setLeagueModalVisible] = useState(false);
    const [sessionModalVisible, setSessionModalVisible] = useState(false);
    const [selectedItem, setSelectedItem] = useState<any>(null); // For edit

    const { clubId } = useLocalSearchParams();
    const router = useRouter();
    const { currentUser } = useAuth();
    const { isAdmin } = useClub();
    const canEdit = currentUser?.isAdmin || isAdmin;

    useEffect(() => {
        if (!clubId) {
            setLoading(false);
            return;
        }

        const qLeagues = query(collection(db, 'leagues'), where('clubId', '==', clubId));
        const unsubscribeLeagues = onSnapshot(qLeagues, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLeagues(data);
        });

        const qSessions = query(
            collection(db, 'sessions'),
            where('clubId', '==', clubId),
            where('leagueId', '==', null)
        );
        const unsubscribeSessions = onSnapshot(qSessions, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSessions(data);
            setLoading(false);
        });

        return () => {
            unsubscribeLeagues();
            unsubscribeSessions();
        };
    }, [clubId]);

    const handleCreate = () => {
        setSelectedItem(null);
        if (view === 'leagues') setLeagueModalVisible(true);
        else setSessionModalVisible(true);
    };

    const handleEdit = (item: any) => {
        setSelectedItem(item);
        if (view === 'leagues') setLeagueModalVisible(true);
        else setSessionModalVisible(true);
    };

    const handleDelete = (id: string, type: 'leagues' | 'sessions') => {
        Alert.alert(
            "Delete Item",
            `Are you sure you want to delete this?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, type, id));
                        } catch (error) {
                            console.error("Error deleting:", error);
                        }
                    }
                }
            ]
        );
    };

    const getData = () => {
        if (view === 'leagues') {
            if (showActiveOnly) {
                // Filter leagues where endDate is not in the past (or hasn't ended yet)
                // Assuming YYYY-MM-DD format strings
                const today = new Date().toISOString().split('T')[0];
                return leagues.filter(l => l.endDate >= today);
            }
            return leagues;
        } else {
            // Sessions
            if (showActiveOnly) {
                return sessions.filter(item => item.status !== 'COMPLETED');
            }
            return sessions;
        }
    };

    const handleLeaguePress = (league: any) => {
        router.push({
            pathname: '/(drawer)/league/[id]',
            params: { id: league.id, clubId: clubId as string }
        });
    };

    const handleSessionPress = (session: any) => {
        router.push({
            pathname: '/(drawer)/session/[id]',
            params: { id: session.id, clubId: clubId as string }
        });
    };

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => view === 'leagues' ? handleLeaguePress(item) : handleSessionPress(item)}
        >
            <View className="bg-slate-800 p-4 rounded-xl mb-3 border border-slate-700 mx-4">
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <View className="flex-row justify-between items-center mb-1">
                            <Text className="text-blue-400 font-bold uppercase text-lg">{item.name}</Text>
                            {canEdit && (
                                <IconButton
                                    icon="delete"
                                    iconColor="#64748b" // slate-500
                                    size={20}
                                    style={{ margin: 0 }}
                                    onPress={() => handleDelete(item.id, view as 'leagues' | 'sessions')}
                                />
                            )}
                        </View>

                        <Text className="text-slate-400 text-xs mb-2">
                            {view === 'leagues'
                                ? `${item.startDate || 'No Date'} - ${item.endDate || 'No Date'}`
                                : new Date(item.scheduledDate).toLocaleDateString()
                            }
                        </Text>

                        <View className="flex-row gap-2 mt-1">
                            <View className="bg-slate-700 rounded-full px-3 py-1 flex-row items-center">
                                <Avatar.Icon size={16} icon="account-group" color="#94a3b8" style={{ backgroundColor: 'transparent' }} />
                                <Text className="text-slate-300 text-xs ml-1 font-medium">{item.players?.length || 0} Players</Text>
                            </View>
                            {item.status === 'COMPLETED' && (
                                <View className="bg-emerald-900/50 border border-emerald-800 rounded-full px-3 py-1 flex-row items-center">
                                    <Avatar.Icon size={16} icon="check" color="#34d399" style={{ backgroundColor: 'transparent' }} />
                                    <Text className="text-emerald-400 text-xs ml-1 font-medium">Done</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    if (!clubId) {
        return (
            <SafeAreaView className="flex-1 justify-center items-center bg-slate-900">
                <Text className="text-slate-400">Please select a club from the menu.</Text>
            </SafeAreaView>
        );
    }

    if (loading) return <View className="flex-1 justify-center bg-slate-900"><ActivityIndicator size="large" color="#5b7cfa" /></View>;

    return (
        <SafeAreaView className="flex-1 bg-slate-900" edges={['bottom', 'left', 'right']}>
            <View className="p-4 mb-2">
                <View className="flex-row items-center justify-between mb-4">
                    <View className="flex-row items-center gap-2">
                        <Avatar.Icon size={28} icon={view === 'leagues' ? 'trophy' : 'tennis-ball'} color="#5b7cfa" style={{ backgroundColor: 'transparent' }} />
                        <Text className="text-white text-xl font-bold">Leagues & Sessions</Text>
                    </View>
                    <View className="flex-row items-center gap-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                        <Text className="text-slate-400 text-xs font-bold">Active Only</Text>
                        <Switch
                            value={showActiveOnly}
                            onValueChange={setShowActiveOnly}
                            color="#5b7cfa"
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                    </View>
                </View>

                <SegmentedButtons
                    value={view}
                    onValueChange={setView}
                    theme={{ colors: { secondaryContainer: '#5b7cfa', onSecondaryContainer: 'white' } }}
                    buttons={[
                        {
                            value: 'leagues',
                            label: 'Leagues',
                            style: {
                                backgroundColor: view === 'leagues' ? '#5b7cfa' : '#1e293b',
                                borderColor: '#334155',
                            },
                            labelStyle: {
                                color: view === 'leagues' ? 'white' : '#94a3b8',
                                fontWeight: 'bold'
                            }
                        },
                        {
                            value: 'sessions',
                            label: 'Pickup',
                            style: {
                                backgroundColor: view === 'sessions' ? '#5b7cfa' : '#1e293b',
                                borderColor: '#334155',
                            },
                            labelStyle: {
                                color: view === 'sessions' ? 'white' : '#94a3b8',
                                fontWeight: 'bold'
                            }
                        },
                    ]}
                />
            </View>

            <FlatList
                data={getData()}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                    <View className="bg-[#161f2f] rounded-lg p-10 items-center justify-center mx-4 border border-slate-700">
                        <Text className="text-slate-500 text-sm">No {showActiveOnly ? 'active ' : ''}{view} found.</Text>
                    </View>
                }
            />

            {canEdit && (
                <FAB
                    icon="plus"
                    label={view === 'leagues' ? 'New League' : 'New Session'}
                    style={{ position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#5b7cfa' }}
                    color="white"
                    onPress={handleCreate}
                />
            )}

            <LeagueModal
                visible={leagueModalVisible}
                onDismiss={() => setLeagueModalVisible(false)}
                league={selectedItem}
            />

            <SessionModal
                visible={sessionModalVisible}
                onDismiss={() => setSessionModalVisible(false)}
                session={selectedItem}
                clubId={clubId as string}
                league={null} // Pickup sessions
            />
        </SafeAreaView>
    );
}
