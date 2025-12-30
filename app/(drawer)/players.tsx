import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { ActivityIndicator, Avatar, FAB, IconButton, Searchbar, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import PlayerModal from '../../components/PlayerModal';
import { useAuth } from '../../contexts/AuthContext';
import { useClub } from '../../contexts/ClubContext';
import { db } from '../../firebase';

export default function PlayersScreen() {
    const [players, setPlayers] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);

    const { currentUser } = useAuth();
    const { isAdmin } = useClub();
    const canEdit = currentUser?.isAdmin || isAdmin;

    useEffect(() => {
        const q = query(collection(db, 'players'), orderBy('firstName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const playersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPlayers(playersData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const filteredPlayers = players.filter(player => {
        const fullName = `${player.firstName} ${player.lastName}`.toLowerCase();
        return fullName.includes(searchQuery.toLowerCase());
    });

    const handleCreate = () => {
        setSelectedPlayer(null);
        setModalVisible(true);
    };

    const handleEdit = (player: any) => {
        if (!canEdit) return;
        setSelectedPlayer(player);
        setModalVisible(true);
    };

    const handleDelete = (player: any) => {
        Alert.alert(
            "Delete Player",
            `Are you sure you want to delete ${player.firstName}?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteDoc(doc(db, 'players', player.id));
                        } catch (error) {
                            console.error("Error deleting:", error);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: any }) => (
        <View className="mb-2 mx-4 bg-slate-800 p-4 rounded-xl border border-slate-700 mt-2">
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1" onTouchEnd={() => handleEdit(item)}>
                    <Avatar.Text
                        size={40}
                        label={`${item.firstName?.[0]}${item.lastName?.[0]}`}
                        style={{ backgroundColor: '#5b7cfa' }}
                        color="white"
                    />
                    <View>
                        <Text className="text-white font-bold text-lg">{item.firstName} {item.lastName}</Text>
                        <Text className="text-slate-400 text-xs">{item.gender || 'Unknown'}</Text>
                        <View className="flex-row gap-2 mt-1">
                            <View className="bg-slate-700/50 rounded px-2 py-0.5">
                                <Text className="text-blue-300 text-xs font-bold">DUPR: {item.duprDoubles || 'N/A'}</Text>
                            </View>
                        </View>
                    </View>
                </View>
                {canEdit && (
                    <IconButton
                        icon="delete"
                        iconColor="#ef4444"
                        size={20}
                        onPress={() => handleDelete(item)}
                    />
                )}
            </View>
        </View>
    );

    if (loading) return <View className="flex-1 justify-center bg-slate-900"><ActivityIndicator size="large" color="#5b7cfa" /></View>;

    return (
        <SafeAreaView className="flex-1 bg-slate-900" edges={['bottom', 'left', 'right']}>
            <View className="p-4 mb-2">
                <View className="flex-row items-center gap-2 mb-4">
                    <Avatar.Icon size={28} icon="account-group" color="#5b7cfa" style={{ backgroundColor: 'transparent' }} />
                    <Text className="text-white text-xl font-bold">Players</Text>
                </View>
                <Searchbar
                    placeholder="Search players..."
                    placeholderTextColor="#94a3b8"
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    className="bg-slate-800 text-white border border-slate-700"
                    iconColor="#94a3b8"
                    inputStyle={{ color: 'white' }}
                    elevation={0}
                />
            </View>

            <FlatList
                data={filteredPlayers}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={
                    <View className="bg-[#161f2f] rounded-lg p-10 items-center justify-center mx-4 border border-slate-700 mt-4">
                        <Text className="text-slate-500 text-sm">No players found.</Text>
                    </View>
                }
            />

            {canEdit && (
                <FAB
                    icon="plus"
                    style={{ position: 'absolute', margin: 16, right: 0, bottom: 0, backgroundColor: '#5b7cfa' }}
                    color="white"
                    onPress={handleCreate}
                />
            )}

            <PlayerModal
                visible={modalVisible}
                onDismiss={() => setModalVisible(false)}
                player={selectedPlayer}
            />
        </SafeAreaView>
    );
}
