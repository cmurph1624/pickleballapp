import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { ActivityIndicator, Card, Chip, FAB, IconButton, SegmentedButtons, Text } from 'react-native-paper';
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

    const renderItem = ({ item }: { item: any }) => (
        <Card
            className="mb-3 mx-4 bg-white dark:bg-slate-800"
            onPress={() => handleEdit(item)}
        >
            <Card.Content>
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <Text variant="titleMedium" className="font-bold">{item.name}</Text>
                        <Text variant="bodySmall" className="text-gray-500">
                            {view === 'leagues'
                                ? `${item.startDate || 'No Date'} - ${item.endDate || 'No Date'}`
                                : new Date(item.scheduledDate).toLocaleDateString()
                            }
                        </Text>
                        <View className="flex-row gap-2 mt-2">
                            <Chip icon="account-group" textStyle={{ fontSize: 10, height: 16 }} style={{ height: 24 }}>
                                {item.players?.length || 0} Players
                            </Chip>
                            {item.status === 'COMPLETED' && (
                                <Chip icon="check" textStyle={{ fontSize: 10, height: 16 }} style={{ height: 24, backgroundColor: '#dcfce7' }}>
                                    Done
                                </Chip>
                            )}
                        </View>
                    </View>
                    {canEdit && (
                        <IconButton
                            icon="delete"
                            iconColor="gray"
                            size={20}
                            onPress={() => handleDelete(item.id, view)}
                        />
                    )}
                </View>
            </Card.Content>
        </Card>
    );

    if (!clubId) {
        return (
            <SafeAreaView className="flex-1 justify-center items-center bg-gray-100 dark:bg-slate-900">
                <Text>Please select a club from the menu.</Text>
            </SafeAreaView>
        );
    }

    if (loading) return <View className="flex-1 justify-center"><ActivityIndicator size="large" /></View>;

    return (
        <SafeAreaView className="flex-1 bg-gray-100 dark:bg-slate-900" edges={['bottom', 'left', 'right']}>
            <View className="p-4 bg-white dark:bg-slate-800 mb-2 shadow-sm">
                <Text variant="headlineSmall" className="font-bold mb-4">Leagues & Sessions</Text>
                <SegmentedButtons
                    value={view}
                    onValueChange={setView}
                    buttons={[
                        {
                            value: 'leagues',
                            label: 'Leagues',
                            icon: 'trophy',
                        },
                        {
                            value: 'sessions',
                            label: 'Pickup',
                            icon: 'tennis-ball',
                        },
                    ]}
                />
            </View>

            <FlatList
                data={view === 'leagues' ? leagues : sessions}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={<Text className="text-center mt-10 text-gray-500">No {view} found.</Text>}
            />

            {canEdit && (
                <FAB
                    icon="plus"
                    label={view === 'leagues' ? 'New League' : 'New Session'}
                    style={{ position: 'absolute', margin: 16, right: 0, bottom: 0 }}
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
