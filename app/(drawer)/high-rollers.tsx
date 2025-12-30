import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import TransactionHistoryModal from '../../components/TransactionHistoryModal';
import { db } from '../../firebase';

export default function HighRollersScreen() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

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
        let rankColor = '#94a3b8'; // Default Slate 400
        let rankBg = '#1e293b'; // Default Slate 800 (mostly invisible or subtle)
        let rankText = '#cbd5e1'; // Default text color

        if (index === 0) {
            rankColor = '#FFD700'; // Gold
            rankBg = 'rgba(255, 215, 0, 0.15)';
            rankText = '#FFD700';
        }
        else if (index === 1) {
            rankColor = '#C0C0C0'; // Silver
            rankBg = 'rgba(192, 192, 192, 0.15)';
            rankText = '#C0C0C0';
        }
        else if (index === 2) {
            rankColor = '#CD7F32'; // Bronze
            rankBg = 'rgba(205, 127, 50, 0.15)';
            rankText = '#CD7F32';
        }

        return (
            <View
                className="mb-2 mx-4 bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row items-center justify-between"
                onTouchEnd={() => handleUserClick(item)}
            >
                <View className="flex-row items-center gap-4">
                    <View
                        style={{ backgroundColor: rankBg, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: index < 3 ? rankColor : '#334155' }}
                    >
                        <Text style={{ color: rankText, fontWeight: 'bold', fontSize: 18 }}>{index + 1}</Text>
                    </View>
                    <View>
                        <Text className="text-white font-bold text-lg">{item.email?.split('@')[0]}</Text>
                        <Text className="text-slate-400 text-xs">Rank #{index + 1}</Text>
                    </View>
                </View>
                <Text className="text-xl font-bold" style={{ color: index < 3 ? '#4ade80' : 'white' }}>
                    ${item.walletBalance?.toFixed(2) || '0.00'}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-slate-900">
                <ActivityIndicator size="large" color="#5b7cfa" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-slate-900" edges={['bottom', 'left', 'right']}>
            <View className="p-4 mb-2">
                <Text className="text-white text-2xl font-bold mb-1">
                    🏆 High Rollers
                </Text>
                <Text className="text-slate-400 text-sm">
                    The wealthiest players in the league.
                </Text>
            </View>
            <FlatList
                data={users}
                renderItem={renderItem}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                    <View className="bg-[#161f2f] rounded-lg p-10 items-center justify-center mx-4 border border-slate-700 mt-4">
                        <Text className="text-slate-500 text-sm">No players found.</Text>
                    </View>
                }
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
