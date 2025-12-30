import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { ActivityIndicator, Card, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';


export default function HighRollersScreen() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const theme = useTheme();

    // Modal State
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);

    useEffect(() => {
        const fetchHighRollers = async () => {
            try {
                const q = query(collection(db, 'users'), orderBy('walletBalance', 'desc'), limit(20));
                const snapshot = await getDocs(q);
                const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUsers(usersData);
            } catch (error) {
                console.error("Error fetching high rollers:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHighRollers();
    }, []);

    const handleUserClick = (user: any) => {
        setSelectedUser(user);
        setHistoryModalVisible(true);
    };

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        let rankColor = theme.colors.primary;
        let rankBg = theme.colors.surfaceVariant;

        if (index === 0) { rankColor = '#FFD700'; rankBg = '#FFF8E1'; } // Gold
        else if (index === 1) { rankColor = '#C0C0C0'; rankBg = '#F5F5F5'; } // Silver
        else if (index === 2) { rankColor = '#CD7F32'; rankBg = '#FFF3E0'; } // Bronze

        return (
            <Card
                className="mb-2 mx-4 bg-white dark:bg-slate-800"
                onPress={() => handleUserClick(item)}
            >
                <Card.Content className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-4">
                        <View
                            style={{ backgroundColor: rankBg, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text style={{ color: rankColor, fontWeight: 'bold', fontSize: 18 }}>{index + 1}</Text>
                        </View>
                        <View>
                            <Text variant="titleMedium" className="font-bold">{item.email?.split('@')[0]}</Text>
                            <Text variant="bodySmall" className="text-gray-500">Rank #{index + 1}</Text>
                        </View>
                    </View>
                    <Text variant="titleLarge" style={{ color: index < 3 ? 'green' : undefined, fontWeight: 'bold' }}>
                        ${item.walletBalance?.toFixed(2) || '0.00'}
                    </Text>
                </Card.Content>
            </Card>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-100 dark:bg-slate-900" edges={['bottom', 'left', 'right']}>
            <View className="p-4 bg-white dark:bg-slate-800 mb-2 shadow-sm">
                <Text variant="headlineSmall" className="font-bold flex-row items-center">
                    🏆 High Rollers
                </Text>
                <Text variant="bodyMedium" className="text-gray-500">
                    The wealthiest players in the league.
                </Text>
            </View>
            <FlatList
                data={users}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={<Text className="text-center mt-10 text-gray-500">No players found.</Text>}
            />

            <TransactionHistoryModal
                visible={historyModalVisible}
                onDismiss={() => setHistoryModalVisible(false)}
                userId={selectedUser?.id}
                userEmail={selectedUser?.email}
            />
        </SafeAreaView>
    );
}
