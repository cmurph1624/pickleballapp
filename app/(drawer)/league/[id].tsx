import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { ActivityIndicator, Button, Card, SegmentedButtons, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import LeagueModal from '../../../components/LeagueModal';
import { useAuth } from '../../../contexts/AuthContext';
import { useClub } from '../../../contexts/ClubContext';
import { db } from '../../../firebase';

export default function LeagueDetailsScreen() {
    const { id, clubId } = useLocalSearchParams();
    const router = useRouter();
    const [league, setLeague] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [playersMap, setPlayersMap] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('standings'); // 'standings' | 'sessions'

    const [leagueModalVisible, setLeagueModalVisible] = useState(false);

    const { currentUser } = useAuth();
    const { isAdmin } = useClub();

    const canEdit = currentUser?.isAdmin || isAdmin;

    useEffect(() => {
        if (!id) return;

        // Fetch all players for name mapping
        const fetchPlayers = async () => {
            const playersSnap = await getDocs(collection(db, 'players'));
            const map: any = {};
            playersSnap.forEach(doc => {
                map[doc.id] = doc.data();
            });
            setPlayersMap(map);
        };
        fetchPlayers();

        // Subscribe to League
        const unsubscribeLeague = onSnapshot(doc(db, 'leagues', id as string), (doc) => {
            if (doc.exists()) {
                setLeague({ id: doc.id, ...doc.data() });
            } else {
                Alert.alert("Error", "League not found");
                router.back();
            }
            setLoading(false);
        });

        // Subscribe to Sessions
        const q = query(collection(db, 'sessions'), where('leagueId', '==', id));
        const unsubscribeSessions = onSnapshot(q, (snapshot) => {
            const sessionsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            sessionsData.sort((a: any, b: any) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
            setSessions(sessionsData);
        });

        return () => {
            unsubscribeLeague();
            unsubscribeSessions();
        };
    }, [id]);

    const getPlayerName = (pid: string) => {
        const p = playersMap[pid];
        return p ? `${p.firstName} ${p.lastName?.charAt(0) || ''}.` : 'Unknown';
    };

    const calculateStandings = () => {
        if (!sessions || sessions.length === 0) return [];

        const stats: any = {};

        // Initialize for all players in the league if possible, 
        // but easier to just iterate sessions and capture all players involved.
        // If league.players exists, we can init them.
        if (league?.players) {
            league.players.forEach((pid: string) => {
                stats[pid] = { id: pid, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, games: 0 };
            });
        }

        sessions.forEach((session: any) => {
            if (session.matches) {
                session.matches.forEach((m: any) => {
                    if (m.team1Score !== undefined && m.team2Score !== undefined) {
                        const isT1Win = m.team1Score > m.team2Score;
                        const isT2Win = m.team2Score > m.team1Score;

                        // Team 1
                        m.team1?.forEach((pid: string) => {
                            if (!stats[pid]) stats[pid] = { id: pid, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, games: 0 };
                            stats[pid].games++;
                            stats[pid].pointsFor += m.team1Score;
                            stats[pid].pointsAgainst += m.team2Score;
                            stats[pid].diff += (m.team1Score - m.team2Score);
                            if (isT1Win) stats[pid].wins++;
                            if (isT2Win) stats[pid].losses++;
                        });

                        // Team 2
                        m.team2?.forEach((pid: string) => {
                            if (!stats[pid]) stats[pid] = { id: pid, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, games: 0 };
                            stats[pid].games++;
                            stats[pid].pointsFor += m.team2Score;
                            stats[pid].pointsAgainst += m.team1Score;
                            stats[pid].diff += (m.team2Score - m.team1Score);
                            if (isT2Win) stats[pid].wins++;
                            if (isT1Win) stats[pid].losses++;
                        });
                    }
                });
            }
        });

        return Object.values(stats).sort((a: any, b: any) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.diff - a.diff;
        });
    };

    const renderStandingItem = ({ item, index }: { item: any, index: number }) => (
        <View className="flex-row items-center bg-slate-800 p-3 mx-4 mb-2 rounded-lg border border-slate-700">
            <View className="w-8 items-center justify-center mr-2">
                <Text className="text-slate-500 font-bold">#{index + 1}</Text>
            </View>
            <View className="flex-1">
                <Text className="text-white font-bold text-base">{getPlayerName(item.id)}</Text>
                <Text className="text-slate-400 text-xs">{item.games} Games Played</Text>
            </View>
            <View className="items-end min-w-[60px]">
                <Text className="text-green-400 font-bold text-lg">{item.wins} W</Text>
                <Text className="text-red-400 text-xs font-bold">{item.losses} L</Text>
            </View>
            <View className="items-end min-w-[50px] ml-4">
                <Text className="text-slate-300 font-bold">{item.diff > 0 ? `+${item.diff}` : item.diff}</Text>
                <Text className="text-slate-500 text-xs">Diff</Text>
            </View>
        </View>
    );

    const handleSessionPress = (sessionId: string) => {
        router.push({
            pathname: '/(drawer)/session/[id]',
            params: { id: sessionId, clubId: clubId as string }
        });
    };

    const renderSessionItem = ({ item }: { item: any }) => (
        <Card className="mb-3 mx-4 bg-slate-800 border-slate-700" onPress={() => handleSessionPress(item.id)}>
            <Card.Content>
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-white text-lg font-bold">{item.name}</Text>
                        <Text className="text-slate-400 text-sm">
                            {new Date(item.scheduledDate).toLocaleDateString()} • {item.matches?.length || 0} Matches
                        </Text>
                    </View>
                    <View className="bg-slate-700 px-3 py-1 rounded-full">
                        <Text className="text-slate-300 text-xs font-bold">View</Text>
                    </View>
                </View>
            </Card.Content>
        </Card>
    );

    if (loading) return <View className="flex-1 justify-center bg-slate-900"><ActivityIndicator size="large" color="#5b7cfa" /></View>;
    if (!league) return <View className="flex-1 justify-center items-center bg-slate-900"><Text className="text-slate-400">League not found.</Text></View>;

    return (
        <SafeAreaView className="flex-1 bg-slate-900" edges={['bottom', 'left', 'right']}>
            <View className="p-4 bg-slate-900">
                <View className="flex-row justify-between items-start mb-4">
                    <View>
                        <Text className="text-white text-2xl font-bold">{league.name}</Text>
                        <Text className="text-slate-400 text-sm">
                            {new Date(league.startDate).toLocaleDateString()} - {new Date(league.endDate).toLocaleDateString()}
                        </Text>
                        <Text className="text-slate-500 text-xs mt-1 uppercase font-bold">{league.type}</Text>
                    </View>
                    {canEdit && (
                        <Button
                            mode="outlined"
                            textColor="#5b7cfa"
                            style={{ borderColor: '#5b7cfa' }}
                            onPress={() => setLeagueModalVisible(true)}
                        >
                            Edit
                        </Button>
                    )}
                </View>

                <SegmentedButtons
                    value={view}
                    onValueChange={setView}
                    theme={{ colors: { secondaryContainer: '#5b7cfa', onSecondaryContainer: 'white' } }}
                    buttons={[
                        {
                            value: 'standings',
                            label: 'Standings',
                            style: { backgroundColor: view === 'standings' ? '#5b7cfa' : '#1e293b', borderColor: '#334155' },
                            labelStyle: { color: view === 'standings' ? 'white' : '#94a3b8', fontWeight: 'bold' }
                        },
                        {
                            value: 'sessions',
                            label: 'Sessions',
                            style: { backgroundColor: view === 'sessions' ? '#5b7cfa' : '#1e293b', borderColor: '#334155' },
                            labelStyle: { color: view === 'sessions' ? 'white' : '#94a3b8', fontWeight: 'bold' }
                        },
                    ]}
                />
            </View>

            {view === 'standings' ? (
                <FlatList
                    data={calculateStandings()}
                    renderItem={renderStandingItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
                    ListEmptyComponent={<Text className="text-center mt-10 text-slate-500">No standings available.</Text>}
                />
            ) : (
                <FlatList
                    data={sessions}
                    renderItem={renderSessionItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 20 }}
                    ListEmptyComponent={<Text className="text-center mt-10 text-slate-500">No sessions found.</Text>}
                />
            )}

            <LeagueModal
                visible={leagueModalVisible}
                onDismiss={() => setLeagueModalVisible(false)}
                league={league}
                clubId={clubId as string}
            />

        </SafeAreaView>
    );
}
