import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { ActivityIndicator, Button, Card, SegmentedButtons, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import ScoreModal from '../../../components/ScoreModal';
import SessionModal from '../../../components/SessionModal';
import { useAuth } from '../../../contexts/AuthContext';
import { useClub } from '../../../contexts/ClubContext';
import { db } from '../../../firebase';

export default function SessionDetailsScreen() {
    const { id, clubId } = useLocalSearchParams();
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [playersMap, setPlayersMap] = useState<any>({});
    const [view, setView] = useState('matches'); // 'matches' | 'standings'

    // Modals
    const [scoreModalVisible, setScoreModalVisible] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<any>(null);
    const [sessionModalVisible, setSessionModalVisible] = useState(false);

    const { currentUser } = useAuth();
    const { isAdmin } = useClub();
    const router = useRouter();

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

        // Subscribe to session
        const unsubscribe = onSnapshot(doc(db, 'sessions', id as string), (doc) => {
            if (doc.exists()) {
                setSession({ id: doc.id, ...doc.data() });
            } else {
                Alert.alert("Error", "Session not found");
                router.back();
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id]);

    const getPlayerName = (pid: string) => {
        const p = playersMap[pid];
        return p ? `${p.firstName} ${p.lastName?.charAt(0) || ''}.` : 'Unknown';
    };

    const handleMatchPress = (match: any) => {
        if (!canEdit) return;
        setSelectedMatch(match);
        setScoreModalVisible(true);
    };

    const handleSaveScore = async (matchId: string, s1: number, s2: number) => {
        if (!session) return;

        const updatedMatches = session.matches.map((m: any) => {
            if (m.id === matchId) {
                return { ...m, team1Score: s1, team2Score: s2 };
            }
            return m;
        });

        try {
            await updateDoc(doc(db, 'sessions', session.id), { matches: updatedMatches });
        } catch (error) {
            console.error("Error saving score:", error);
            Alert.alert("Error", "Failed to save score");
        }
    };

    const calculateStandings = () => {
        if (!session || !session.matches) return [];

        const stats: any = {};

        // Initialize stats for all players in the session
        session.players?.forEach((pid: string) => {
            stats[pid] = { id: pid, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, diff: 0, games: 0 };
        });

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

        return Object.values(stats).sort((a: any, b: any) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.diff - a.diff;
        });
    };

    const renderMatchItem = ({ item }: { item: any }) => {
        const hasScore = item.team1Score !== undefined && item.team2Score !== undefined;
        // Group logic is handled in ListHeaderComponent or data prep, but simpler here:
        // We will just render a card.

        return (
            <Card className="mb-3 mx-4 bg-slate-800 border-slate-700" onPress={() => handleMatchPress(item)}>
                <Card.Content>
                    <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-slate-400 text-xs font-bold uppercase">{item.courtName || 'Court ?'}</Text>
                        {hasScore ? (
                            <View className="bg-slate-700 px-2 py-0.5 rounded">
                                <Text className="text-white text-xs font-bold">Final</Text>
                            </View>
                        ) : (
                            canEdit && <Text className="text-blue-400 text-xs font-bold">Tap to Score</Text>
                        )}
                    </View>

                    <View className="flex-row justify-between items-center">
                        {/* Team 1 */}
                        <View className="flex-1">
                            <Text className={`text-white font-bold text-base ${hasScore && item.team1Score > item.team2Score ? 'text-green-400' : ''}`}>
                                {getPlayerName(item.team1[0])}
                            </Text>
                            <Text className={`text-white font-bold text-base ${hasScore && item.team1Score > item.team2Score ? 'text-green-400' : ''}`}>
                                {getPlayerName(item.team1[1])}
                            </Text>
                        </View>

                        {/* Scores */}
                        <View className="flex-row items-center gap-4 bg-slate-900 px-4 py-2 rounded-lg border border-slate-700 mx-2">
                            <Text className={`text-2xl font-bold ${hasScore && item.team1Score > item.team2Score ? 'text-green-400' : 'text-white'}`}>
                                {hasScore ? item.team1Score : '-'}
                            </Text>
                            <Text className="text-slate-500">-</Text>
                            <Text className={`text-2xl font-bold ${hasScore && item.team2Score > item.team1Score ? 'text-green-400' : 'text-white'}`}>
                                {hasScore ? item.team2Score : '-'}
                            </Text>
                        </View>

                        {/* Team 2 */}
                        <View className="flex-1 items-end">
                            <Text className={`text-white font-bold text-base ${hasScore && item.team2Score > item.team1Score ? 'text-green-400' : ''}`}>
                                {getPlayerName(item.team2[0])}
                            </Text>
                            <Text className={`text-white font-bold text-base ${hasScore && item.team2Score > item.team1Score ? 'text-green-400' : ''}`}>
                                {getPlayerName(item.team2[1])}
                            </Text>
                        </View>
                    </View>
                </Card.Content>
            </Card>
        );
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

    if (loading) return <View className="flex-1 justify-center bg-slate-900"><ActivityIndicator size="large" color="#5b7cfa" /></View>;
    if (!session) return <View className="flex-1 justify-center items-center bg-slate-900"><Text className="text-slate-400">Session not found.</Text></View>;

    // Group matches by round for rendering
    // Assuming 'round' property exists or we derive it indices. Legacy app used grid. 
    // We can just list them flat with "Round X" headers or just flat list. 
    // Legacy app showed "Round 1", "Round 2". Let's try to infer if stored, else just list.
    // Usually legacy structure was just an array.

    // Let's create a SectionList-like structure manually or just render with headers if needed.
    // For simplicity, just a FlatList. Maybe add headers every N matches if court count implies it?
    // Safe bet: just list them.

    return (
        <SafeAreaView className="flex-1 bg-slate-900" edges={['top', 'bottom', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* Custom Header */}
            <View className="flex-row items-center p-4 border-b border-slate-800">
                <Button
                    mode="text"
                    textColor="#ffffff"
                    icon="arrow-left"
                    onPress={() => router.back()}
                    className="mr-2"
                >
                    Back
                </Button>
            </View>

            <View className="p-4 bg-slate-900">
                <View className="flex-row justify-between items-start mb-6">
                    <View>
                        <Text className="text-white text-3xl font-bold mb-1">{session.name}</Text>
                        <View className="flex-row items-center gap-2">
                            <View className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                                <Text className="text-slate-300 text-xs font-bold">
                                    {new Date(session.scheduledDate).toLocaleDateString()}
                                </Text>
                            </View>
                            <View className="bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                                <Text className="text-slate-300 text-xs font-bold">
                                    {session.matches?.length || 0} Matches
                                </Text>
                            </View>
                        </View>
                    </View>
                    {canEdit && (
                        <Button
                            mode="contained"
                            buttonColor="#5b7cfa"
                            textColor="white"
                            onPress={() => setSessionModalVisible(true)}
                            className="rounded-lg"
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
                            value: 'matches',
                            label: 'Matches',
                            style: { backgroundColor: view === 'matches' ? '#5b7cfa' : '#1e293b', borderColor: '#334155' },
                            labelStyle: { color: view === 'matches' ? 'white' : '#94a3b8', fontWeight: 'bold' }
                        },
                        {
                            value: 'standings',
                            label: 'Standings',
                            style: { backgroundColor: view === 'standings' ? '#5b7cfa' : '#1e293b', borderColor: '#334155' },
                            labelStyle: { color: view === 'standings' ? 'white' : '#94a3b8', fontWeight: 'bold' }
                        },
                    ]}
                    className="mb-4"
                />
            </View>

            {view === 'matches' ? (
                <FlatList
                    data={session.matches || []}
                    renderItem={renderMatchItem}
                    keyExtractor={(item, index) => item.id || String(index)}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
                    ListEmptyComponent={
                        <View className="items-center justify-center p-8 bg-slate-800 mx-4 rounded-xl border border-slate-700 border-dashed">
                            <Text className="text-slate-400 font-bold mb-2">No matches scheduled</Text>
                            <Text className="text-slate-500 text-center text-xs">Matches will appear here once generated.</Text>
                        </View>
                    }
                    ItemSeparatorComponent={() => <View className="h-3" />}
                />
            ) : (
                <FlatList
                    data={calculateStandings()}
                    renderItem={renderStandingItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    ListEmptyComponent={<Text className="text-center mt-10 text-slate-500">No standings available.</Text>}
                />
            )}

            <ScoreModal
                visible={scoreModalVisible}
                onDismiss={() => setScoreModalVisible(false)}
                match={selectedMatch}
                onSave={handleSaveScore}
                team1Name={selectedMatch ? `${getPlayerName(selectedMatch.team1[0])} & ${getPlayerName(selectedMatch.team1[1])}` : ''}
                team2Name={selectedMatch ? `${getPlayerName(selectedMatch.team2[0])} & ${getPlayerName(selectedMatch.team2[1])}` : ''}
            />

            <SessionModal
                visible={sessionModalVisible}
                onDismiss={() => setSessionModalVisible(false)}
                session={session}
                clubId={clubId as string}
                league={null} // existing logic
            />

        </SafeAreaView>
    );
}
