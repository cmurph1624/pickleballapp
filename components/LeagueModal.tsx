import { addDoc, collection, doc, getDocs, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Button, Checkbox, HelperText, Modal, Portal, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { db } from '../firebase';

interface LeagueModalProps {
    visible: boolean;
    onDismiss: () => void;
    league?: any;
}

const LeagueModal = ({ visible, onDismiss, league }: LeagueModalProps) => {
    const theme = useTheme();
    const { clubId } = useClub();
    const { currentUser } = useAuth();

    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [type, setType] = useState('Cumulative');
    const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);

    const [allPlayers, setAllPlayers] = useState<any[]>([]);
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const q = query(collection(db, 'players'), orderBy('firstName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const playersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAllPlayers(playersData);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (visible) {
            if (league) {
                setName(league.name);
                setStartDate(league.startDate);
                setEndDate(league.endDate);
                setType(league.type);
                setSelectedPlayers(league.players || []);
            } else {
                setName('');
                setStartDate('');
                setEndDate('');
                setType('Cumulative');
                setSelectedPlayers([]);
            }
            setErrors({});
        }
    }, [visible, league]);

    const handlePlayerToggle = (playerId: string) => {
        if (selectedPlayers.includes(playerId)) {
            setSelectedPlayers(prev => prev.filter(id => id !== playerId));
        } else {
            setSelectedPlayers(prev => [...prev, playerId]);
        }
    };

    const validate = async () => {
        const newErrors: { [key: string]: string } = {};

        if (!name.trim()) newErrors.name = "Name is required";
        if (!startDate) newErrors.startDate = "Start date is required";
        if (!endDate) newErrors.endDate = "End date is required";

        if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
            newErrors.endDate = "End date cannot be before start date.";
        }

        if (name.trim()) {
            if (!league || league.name !== name.trim()) {
                const q = query(collection(db, 'leagues'), where("name", "==", name.trim()));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                    newErrors.name = "League name already exists.";
                }
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (loading) return;

        const isValid = await validate();
        if (!isValid) return;

        setLoading(true);

        const data: any = {
            clubId: clubId,
            name: name,
            startDate: startDate,
            endDate: endDate,
            type: type,
            players: selectedPlayers,
            updatedAt: new Date()
        };

        try {
            if (league) {
                await updateDoc(doc(db, 'leagues', league.id), data);
            } else {
                data.createdAt = new Date();
                data.createdBy = currentUser ? currentUser.uid : 'anonymous';
                await addDoc(collection(db, 'leagues'), data);
            }
            onDismiss();
        } catch (error: any) {
            console.error("Error saving league:", error);
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
                    <Text variant="titleLarge" className="font-bold text-white max-w-[80%]">{league ? 'Edit League' : 'New League'}</Text>
                </View>

                <ScrollView className="p-4 bg-slate-900">
                    <TextInput
                        label="League Name"
                        value={name}
                        onChangeText={setName}
                        mode="outlined"
                        error={!!errors.name}
                        className="mb-2 bg-slate-800"
                        textColor="white"
                        theme={inputTheme}
                    />
                    {errors.name && <HelperText type="error" visible={true} padding="none" style={{ color: '#ef4444', marginBottom: 8 }}>{errors.name}</HelperText>}

                    <TextInput
                        label="Start Date (YYYY-MM-DD)" // In a real app, use a date picker
                        value={startDate}
                        onChangeText={setStartDate}
                        mode="outlined"
                        placeholder="2024-01-01"
                        placeholderTextColor="#64748b"
                        error={!!errors.startDate}
                        className="mb-2 bg-slate-800"
                        textColor="white"
                        theme={inputTheme}
                    />
                    {errors.startDate && <HelperText type="error" visible={true} padding="none" style={{ color: '#ef4444', marginBottom: 8 }}>{errors.startDate}</HelperText>}

                    <TextInput
                        label="End Date (YYYY-MM-DD)"
                        value={endDate}
                        onChangeText={setEndDate}
                        mode="outlined"
                        placeholder="2024-12-31"
                        placeholderTextColor="#64748b"
                        error={!!errors.endDate}
                        className="mb-4 bg-slate-800"
                        textColor="white"
                        theme={inputTheme}
                    />
                    {errors.endDate && <HelperText type="error" visible={true} padding="none" style={{ color: '#ef4444', marginBottom: 8 }}>{errors.endDate}</HelperText>}

                    <Text className="mb-2 font-bold text-white">Type</Text>
                    <SegmentedButtons
                        value={type}
                        onValueChange={setType}
                        buttons={[
                            { value: 'Cumulative', label: 'Cumulative', style: { backgroundColor: type === 'Cumulative' ? '#5b7cfa' : '#1e293b', borderColor: '#334155' }, labelStyle: { color: type === 'Cumulative' ? 'white' : '#94a3b8' } },
                            { value: 'Open Play', label: 'Open Play', style: { backgroundColor: type === 'Open Play' ? '#5b7cfa' : '#1e293b', borderColor: '#334155' }, labelStyle: { color: type === 'Open Play' ? 'white' : '#94a3b8' } },
                        ]}
                        className="mb-4"
                        theme={{ colors: { secondaryContainer: '#5b7cfa', onSecondaryContainer: 'white' } }}
                    />

                    {type !== 'Open Play' && (
                        <View className="mb-4 border border-slate-700 rounded-lg p-2 max-h-48 bg-slate-800">
                            <Text className="font-bold mb-2 text-white">Select Players</Text>
                            <ScrollView nestedScrollEnabled>
                                {allPlayers.map(player => (
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
                                {allPlayers.length === 0 && <Text className="text-slate-500 italic">No players found.</Text>}
                            </ScrollView>
                        </View>
                    )}
                </ScrollView>

                <View className="p-4 border-t border-slate-700 bg-slate-800 rounded-b-xl flex-row justify-end gap-2">
                    <Button onPress={onDismiss} textColor="#94a3b8">Cancel</Button>
                    <Button mode="contained" onPress={handleSubmit} loading={loading} buttonColor="#5b7cfa" textColor="white">Save</Button>
                </View>
            </Modal>
        </Portal>
    );
};

export default LeagueModal;
