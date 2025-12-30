import { collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { ActivityIndicator, Avatar, Card, Chip, FAB, IconButton, Searchbar, Text } from 'react-native-paper';
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
        <Card
            className="mb-2 mx-4 bg-white dark:bg-slate-800"
            onPress={() => handleEdit(item)}
        >
            <Card.Content className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                    <Avatar.Text
                        size={40}
                        label={`${item.firstName?.[0]}${item.lastName?.[0]}`}
                        className="bg-primary"
                    />
                    <View>
                        <Text variant="titleMedium" className="font-bold">{item.firstName} {item.lastName}</Text>
                        <Text variant="bodySmall" className="text-gray-500">{item.gender || 'Unknown'}</Text>
                        <View className="flex-row gap-2 mt-1">
                            <Chip textStyle={{ fontSize: 10, height: 16 }} style={{ height: 24 }}>D: {item.duprDoubles || 'N/A'}</Chip>
                        </View>
                    </View>
                </View>
                {canEdit && (
                    <IconButton icon="delete" iconColor="red" size={20} onPress={() => handleDelete(item)} />
                )}
            </Card.Content>
        </Card>
    );

    if (loading) return <View className="flex-1 justify-center"><ActivityIndicator size="large" /></View>;

    return (
        <SafeAreaView className="flex-1 bg-gray-100 dark:bg-slate-900" edges={['bottom', 'left', 'right']}>
            <View className="p-4 bg-white dark:bg-slate-800 mb-2 shadow-sm">
                <Text variant="headlineSmall" className="font-bold mb-2">Players</Text>
                <Searchbar
                    placeholder="Search players..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                    className="bg-gray-100 dark:bg-slate-700"
                    elevation={0}
                />
            </View>

            <FlatList
                data={filteredPlayers}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 80 }}
                ListEmptyComponent={<Text className="text-center mt-10 text-gray-500">No players found.</Text>}
            />

            {canEdit && (
                <FAB
                    icon="plus"
                    style={{ position: 'absolute', margin: 16, right: 0, bottom: 0 }}
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
