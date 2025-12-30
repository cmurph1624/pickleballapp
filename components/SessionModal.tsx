import { addDoc, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Button, Checkbox, Modal, Portal, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';

interface SessionModalProps {
    visible: boolean;
    onDismiss: () => void;
    session?: any;
    league?: any;
    clubId: string;
}

const SessionModal = ({ visible, onDismiss, session, league, clubId }: SessionModalProps) => {
    const theme = useTheme();
    const { currentUser } = useAuth();

    // Form State
    const [name, setName] = useState('');
    const [courtCount, setCourtCount] = useState('');
    const [courtNames, setCourtNames] = useState('');
    const [gamesPerPlayer, setGamesPerPlayer] = useState('');
    const [bettingDeadline, setBettingDeadline] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

    // Data State
    const [leaguePlayers, setLeaguePlayers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Fetch players relevant to league/club
    useEffect(() => {
        const q = query(collection(db, 'players'), orderBy('firstName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (league && league.type !== 'Open Play') {
                if (!league.players || league.players.length === 0) {
                    playersData = [];
                } else {
                    playersData = playersData.filter(p => league.players.includes(p.id));
                }
            }
            setLeaguePlayers(playersData);
        });
        return () => unsubscribe();
    }, [league, visible]);

    // Populate Form
    useEffect(() => {
        if (visible) {
            if (session) {
                setName(session.name);
                setCourtCount(session.courts ? session.courts.length.toString() : '');
                setCourtNames(session.courts ? session.courts.join(', ') : '');
                setGamesPerPlayer(session.gamesPerPlayer?.toString() || '');
                setBettingDeadline(session.bettingDeadline || '');
                setScheduledDate(session.scheduledDate || '');
                setSelectedPlayers(session.players || []);
            } else {
                setName('');
                setCourtCount('');
                setCourtNames('');
                setGamesPerPlayer('');
                setBettingDeadline('');
                setScheduledDate('');
                setSelectedPlayers([]);
            }
        }
    }, [visible, session]);

    const handlePlayerToggle = (playerId: string) => {
        if (selectedPlayers.includes(playerId)) {
            setSelectedPlayers(prev => prev.filter(id => id !== playerId));
        } else {
            setSelectedPlayers(prev => [...prev, playerId]);
        }
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            Alert.alert("Error", "Session Name is required");
            return;
        }

        setLoading(true);

        // Generate courts
        let courts = [];
        const count = parseInt(courtCount) || 0;
        if (count > 0) {
            const providedNames = courtNames
                ? courtNames.split(',').map(s => s.trim()).filter(s => s !== '')
                : [];
            for (let i = 0; i < count; i++) {
                if (i < providedNames.length) {
                    courts.push(providedNames[i]);
                } else {
                    courts.push(`Court ${i + 1}`);
                }
            }
        }

        const data: any = {
            name: name,
            players: selectedPlayers,
            gamesPerPlayer: parseInt(gamesPerPlayer) || 0,
            bettingDeadline: bettingDeadline,
            scheduledDate: scheduledDate,
            courts: courts,
            updatedAt: new Date()
        };

        if (league) {
            data.leagueId = league.id;
        } else {
            data.leagueId = null;
            data.clubId = clubId;
        }

        try {
            if (session) {
                await updateDoc(doc(db, 'sessions', session.id), data);
            } else {
                data.createdAt = new Date();
                data.createdBy = currentUser ? currentUser.uid : 'anonymous';
                await addDoc(collection(db, 'sessions'), data);
            }
            onDismiss();
        } catch (error: any) {
            console.error("Error saving session:", error);
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const inputTheme = {
        colors: {
            background: '#1e293b',
            text: 'white',
            onSurfaceVariant: '#94a3b8',
            placeholder: '#94a3b8',
            primary: '#5b7cfa',
            error: '#ef4444'
        }
    };

    return (
        <Portal>
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={{ backgroundColor: '#0f172a', margin: 20, borderRadius: 12, maxHeight: '90%', borderWidth: 1, borderColor: '#334155' }}>
                <View className="p-4 border-b border-slate-700 bg-slate-800 rounded-t-xl">
                    <Text variant="titleLarge" className="font-bold text-white max-w-[80%]">{session ? 'Edit Session' : 'Add Session'}</Text>
                </View>

                <ScrollView className="p-4 bg-slate-900">
                    <TextInput
                        label="Session Name"
                        value={name}
                        onChangeText={setName}
                        mode="outlined"
                        className="mb-2 bg-slate-800"
                        textColor="white"
                        theme={inputTheme}
                    />

                    <View className="flex-row gap-2 mb-2">
                        <TextInput
                            label="Courts Limit"
                            value={courtCount}
                            onChangeText={setCourtCount}
                            mode="outlined"
                            keyboardType="numeric"
                            style={{ flex: 1 }}
                            className="bg-slate-800"
                            textColor="white"
                            theme={inputTheme}
                        />
                        <TextInput
                            label="Rounds"
                            value={gamesPerPlayer}
                            onChangeText={setGamesPerPlayer}
                            mode="outlined"
                            keyboardType="numeric"
                            style={{ flex: 1 }}
                            className="bg-slate-800"
                            textColor="white"
                            theme={inputTheme}
                        />
                    </View>

                    <TextInput
                        label="Court Names (Optional, comma separated)"
                        value={courtNames}
                        onChangeText={setCourtNames}
                        mode="outlined"
                        className="mb-2 bg-slate-800"
                        textColor="white"
                        theme={inputTheme}
                    />

                    <TextInput
                        label="Scheduled Date (ISO string for now)"
                        value={scheduledDate}
                        onChangeText={setScheduledDate}
                        mode="outlined"
                        placeholder="2024-01-01T10:00:00"
                        placeholderTextColor="#64748b"
                        className="mb-2 bg-slate-800"
                        textColor="white"
                        theme={inputTheme}
                    />

                    <TextInput
                        label="Betting Deadline (ISO string)"
                        value={bettingDeadline}
                        onChangeText={setBettingDeadline}
                        mode="outlined"
                        placeholder="2024-01-01T09:00:00"
                        placeholderTextColor="#64748b"
                        className="mb-4 bg-slate-800"
                        textColor="white"
                        theme={inputTheme}
                    />

                    <View className="mb-4 border border-slate-700 rounded-lg p-2 max-h-48 bg-slate-800">
                        <View className="flex-row justify-between mb-2">
                            <Text className="font-bold text-white">Select Players</Text>
                            <Text className="text-slate-400">{selectedPlayers.length} / {leaguePlayers.length}</Text>
                        </View>
                        <ScrollView nestedScrollEnabled>
                            {leaguePlayers.map(player => (
                                <View key={player.id} className="flex-row items-center py-1">
                                    <Checkbox
                                        status={selectedPlayers.includes(player.id) ? 'checked' : 'unchecked'}
                                        onPress={() => handlePlayerToggle(player.id)}
                                        color="#5b7cfa"
                                        uncheckedColor="#64748b"
                                    />
                                    <Text className="text-slate-300">{player.firstName} {player.lastName}</Text>
                                </View>
                            ))}
                            {leaguePlayers.length === 0 && <Text className="text-slate-500 italic">No players available.</Text>}
                        </ScrollView>
                    </View>
                </ScrollView>

                <View className="p-4 border-t border-slate-700 bg-slate-800 rounded-b-xl flex-row justify-end gap-2">
                    <Button onPress={onDismiss} textColor="#94a3b8">Cancel</Button>
                    <Button mode="contained" onPress={handleSubmit} loading={loading} buttonColor="#5b7cfa" textColor="white">Save</Button>
                </View>
            </Modal>
        </Portal>
    );
};

export default SessionModal;
