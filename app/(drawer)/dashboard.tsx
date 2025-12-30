import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { Avatar, Button, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

export default function DashboardScreen() {
  const { currentUser, logout } = useAuth();
  const theme = useTheme();
  const [showHistory, setShowHistory] = useState(false); // Default false = Left = Upcoming Only

  const [sessions, setSessions] = useState([]);
  const [bets, setBets] = useState([]);

  useEffect(() => {
    if (!currentUser) return;

    // 1. Fetch Open Bets
    const betsQuery = query(
      collection(db, 'bets'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'OPEN')
    );

    const unsubscribeBets = onSnapshot(betsQuery, (snapshot) => {
      const fetchedBets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBets(fetchedBets);
    });

    // 2. Fetch All Sessions
    const sessionsQuery = query(collection(db, 'sessions'));

    const unsubscribeSessions = onSnapshot(sessionsQuery, (snapshot) => {
      const fetchedSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by date ascending (oldest to newest)
      const sortedSessions = fetchedSessions.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
      });
      setSessions(sortedSessions);
    });

    return () => {
      unsubscribeBets();
      unsubscribeSessions();
    };
  }, [currentUser]);

  const displayedSessions = showHistory
    ? sessions // Show All (History + Upcoming)
    : sessions.filter(s => {
      if (!s.date) return false;
      const sessionDate = new Date(s.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      // Active upcoming sessions in the next week
      // Status != COMPLETED and Date is within [Today, Today+7]
      return s.status !== 'COMPLETED' && sessionDate >= today && sessionDate <= nextWeek;
    });

  return (
    <SafeAreaView className="flex-1 bg-slate-900" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* Header */}


        {/* Wallet Balance Card */}
        <View className="mb-10 bg-[#5b7cfa] rounded-xl p-6 shadow-lg">
          <View className="flex-row items-center mb-2">
            <Avatar.Icon size={24} icon="wallet-outline" color="white" style={{ backgroundColor: 'transparent', margin: 0, padding: 0 }} />
            <Text className="text-blue-100 text-xs font-bold uppercase tracking-widest ml-2">WALLET BALANCE</Text>
          </View>
          <Text className="text-white text-5xl font-bold mb-6">
            ${currentUser?.walletBalance?.toFixed(2) || '0.00'}
          </Text>

          <View className="flex-row justify-between items-center">
            <View className="bg-blue-800/20 px-3 py-1.5 rounded-md">
              <Text className="text-blue-50 text-xs font-medium">Available for betting</Text>
            </View>
            <Button
              mode="contained"
              buttonColor="white"
              textColor="#5b7cfa"
              className="rounded-lg"
              labelStyle={{ fontWeight: 'bold' }}
              onPress={() => console.log('Deposit')}
            >
              Deposit
            </Button>
          </View>
        </View>

        {/* Upcoming Schedule */}
        <View className="mb-8">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Avatar.Icon size={24} icon="magnify" color="#5b7cfa" style={{ backgroundColor: 'transparent' }} />
              <Text className="text-white text-lg font-bold">Upcoming Schedule</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Switch
                value={showHistory}
                onValueChange={setShowHistory}
                trackColor={{ true: '#5b7cfa', false: '#334155' }}
                thumbColor={'white'}
              />
            </View>
          </View>

          {displayedSessions.length > 0 ? (
            displayedSessions.map(session => (
              <View key={session.id} className="bg-slate-800 p-4 rounded-xl mb-3 border border-slate-700">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-blue-400 font-bold uppercase">{session.name || 'Session'}</Text>
                  <Text className="text-slate-400 text-xs">{session.date ? new Date(session.date).toLocaleDateString() : 'No Date'}</Text>
                </View>
                <Text className="text-white font-medium">{session.location || 'Unknown Location'}</Text>
                <Text className="text-slate-500 text-xs mt-1">{session.type || 'Mixed Match'}</Text>
              </View>
            ))
          ) : (
            <View className="bg-[#161f2f] rounded-lg p-10 items-center justify-center min-h-[120px]">
              <Text className="text-slate-500 text-sm">No upcoming matches scheduled.</Text>
            </View>
          )}
        </View>

        {/* Active Bets */}
        <View className="mb-8">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Avatar.Icon size={24} icon="trophy-outline" color="#f97316" style={{ backgroundColor: 'transparent' }} />
              <Text className="text-white text-lg font-bold">Active Bets ({bets.length})</Text>
            </View>
            {bets.length > 0 && (
              <Button
                mode="contained"
                buttonColor="#fecaca"
                textColor="#dc2626"
                className="rounded-md"
                labelStyle={{ fontSize: 10, lineHeight: 12, marginVertical: 4, marginHorizontal: 8, fontWeight: 'bold' }}
                contentStyle={{ height: 28 }}
                onPress={() => console.log('Delete all bets')}
              >
                Delete All Bets
              </Button>
            )}
          </View>

          {bets.length > 0 ? (
            bets.map(bet => (
              <View key={bet.id} className="bg-slate-800 p-4 rounded-xl mb-3 border border-slate-700 flex-row justify-between items-center">
                <View>
                  <Text className="text-white font-bold">Bet on Team {bet.teamPicked}</Text>
                  <Text className="text-slate-500 text-xs">Amount: ${bet.amount}</Text>
                </View>
                <View className="bg-orange-500/20 px-2 py-1 rounded">
                  <Text className="text-orange-400 text-xs font-bold">OPEN</Text>
                </View>
              </View>
            ))
          ) : (
            <View className="bg-[#161f2f] rounded-lg p-10 items-center justify-center min-h-[120px]">
              <Text className="text-slate-500 text-sm">No active bets found.</Text>
            </View>
          )}
        </View>

        <Button
          mode="outlined"
          onPress={() => {
            console.log('Logout pressed');
            logout();
          }}
          contentStyle={{ height: 48 }}
          className="rounded-full border-red-500 mb-8"
          labelStyle={{ color: '#ef4444' }}
        >
          Sign Out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
