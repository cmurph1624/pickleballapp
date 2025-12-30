import { collection, documentId, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { ActivityIndicator, Button, Modal, Portal, Text } from 'react-native-paper';
import { db } from '../firebase';

interface TransactionHistoryModalProps {
    visible: boolean;
    onDismiss: () => void;
    userId?: string;
    userEmail?: string;
}

const TransactionHistoryModal = ({ visible, onDismiss, userId, userEmail }: TransactionHistoryModalProps) => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (visible && userId) {
                setLoading(true);
                try {
                    // 1. Fetch Bets
                    const betsQuery = query(collection(db, 'bets'), where('userId', '==', userId));
                    const betsSnap = await getDocs(betsQuery);
                    let bets = betsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                    // Sort descending
                    bets.sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds);

                    if (bets.length === 0) {
                        setTransactions([]);
                        setLoading(false);
                        return;
                    }

                    // 2. Fetch Sessions details
                    const sessionIds = [...new Set(bets.map((b: any) => b.sessionId || b.weekId))];
                    const sessionsData: any = {};

                    // Fetch all players for name lookup
                    const playersSnap = await getDocs(collection(db, 'players'));
                    const playersMap: any = {};
                    playersSnap.forEach(doc => {
                        playersMap[doc.id] = `${doc.data().firstName} ${doc.data().lastName}`;
                    });

                    // Batch fetch sessions (in a real app, optimize this or use caching)
                    const sessionDocs = await Promise.all(
                        sessionIds.map(id => getDocs(query(collection(db, 'sessions'), where(documentId(), '==', id))))
                    );

                    sessionDocs.forEach(snap => {
                        if (!snap.empty) {
                            const doc = snap.docs[0];
                            sessionsData[doc.id] = doc.data();
                        }
                    });

                    // 3. Assemble
                    const history = bets.map((bet: any) => {
                        const sessionId = bet.sessionId || bet.weekId;
                        const session = sessionsData[sessionId];
                        const match = session?.matches?.find((m: any) => m.id === bet.matchId);

                        let matchDesc = "Unknown Match";
                        if (match) {
                            const t1 = `${playersMap[match.team1[0]] || '?'} & ${playersMap[match.team1[1]] || '?'}`;
                            const t2 = `${playersMap[match.team2[0]] || '?'} & ${playersMap[match.team2[1]] || '?'}`;
                            matchDesc = `${t1} vs ${t2}`;
                        }

                        // P&L Logic
                        let pnl = 0;
                        let color = '#94a3b8'; // Default slate gray
                        let statusColor = '#334155'; // Dark slate for background

                        if (bet.status === 'WON') {
                            pnl = bet.amount;
                            color = '#4ade80'; // Green 400
                            statusColor = 'rgba(74, 222, 128, 0.2)'; // Green transparent
                        } else if (bet.status === 'LOST') {
                            pnl = -bet.amount;
                            color = '#f87171'; // Red 400
                            statusColor = 'rgba(248, 113, 113, 0.2)'; // Red transparent
                        } else if (bet.status === 'PUSH') {
                            pnl = 0;
                            color = '#fbbf24'; // Amber 400
                            statusColor = 'rgba(251, 191, 36, 0.2)'; // Amber transparent
                        }

                        return {
                            ...bet,
                            sessionName: session?.name || 'Unknown Session',
                            matchDesc,
                            pnl,
                            pnlColor: color,
                            statusBg: statusColor
                        };
                    });

                    setTransactions(history);

                } catch (error) {
                    console.error("Error fetching history:", error);
                } finally {
                    setLoading(false);
                }
            }
        };

        fetchHistory();
    }, [visible, userId]);

    const renderItem = ({ item }: { item: any }) => (
        <View className="mb-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
            <View className="flex-row justify-between mb-1">
                <Text className="font-bold text-white text-base">{item.sessionName}</Text>
                <Text style={{ color: item.pnlColor, fontWeight: 'bold', fontSize: 16 }}>
                    {item.pnl > 0 ? `+$${item.pnl}` : item.pnl < 0 ? `-$${Math.abs(item.pnl)}` : '$0'}
                </Text>
            </View>
            <Text className="text-xs text-slate-400 mb-2">{item.matchDesc}</Text>

            <View className="flex-row justify-between items-center bg-slate-700/50 p-2 rounded">
                <Text className="text-xs text-slate-300">
                    Pick: <Text className="font-bold text-white">Team {item.teamPicked}</Text> • ${item.amount}
                </Text>
                <View style={{ backgroundColor: item.statusBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                    <Text style={{ color: item.pnlColor, fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>{item.status}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={{ backgroundColor: '#0f172a', margin: 20, borderRadius: 12, height: '80%', borderWidth: 1, borderColor: '#334155' }}>
                <View className="p-4 border-b border-slate-700 bg-slate-800 rounded-t-xl flex-row justify-between items-center">
                    <View>
                        <Text variant="titleMedium" className="font-bold text-white">Transaction History</Text>
                        <Text variant="bodySmall" className="text-slate-400">{userEmail}</Text>
                    </View>
                    <Button onPress={onDismiss} textColor="#94a3b8">Close</Button>
                </View>

                {loading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#5b7cfa" />
                    </View>
                ) : (
                    <FlatList
                        data={transactions}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ padding: 16 }}
                        ListEmptyComponent={
                            <View className="flex-1 items-center justify-center mt-10">
                                <Text className="text-slate-500">No history found.</Text>
                            </View>
                        }
                    />
                )}
            </Modal>
        </Portal>
    );
};

export default TransactionHistoryModal;
