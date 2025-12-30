import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, HelperText, Modal, Portal, Text, TextInput, useTheme } from 'react-native-paper';

interface ScoreModalProps {
    visible: boolean;
    onDismiss: () => void;
    match: any;
    onSave: (matchId: string, score1: number, score2: number) => void;
    team1Name: string;
    team2Name: string;
}

const ScoreModal = ({ visible, onDismiss, match, onSave, team1Name, team2Name }: ScoreModalProps) => {
    const theme = useTheme();
    const [score1, setScore1] = useState('');
    const [score2, setScore2] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (visible) {
            if (match) {
                setScore1(match.team1Score !== undefined ? String(match.team1Score) : '');
                setScore2(match.team2Score !== undefined ? String(match.team2Score) : '');
            } else {
                setScore1('');
                setScore2('');
            }
            setError('');
        }
    }, [visible, match]);

    const handleSave = () => {
        const s1 = parseInt(score1);
        const s2 = parseInt(score2);

        if (isNaN(s1) || isNaN(s2)) {
            setError('Please enter valid scores for both teams.');
            return;
        }

        if (s1 < 0 || s2 < 0) {
            setError('Scores cannot be negative.');
            return;
        }

        onSave(match.id, s1, s2);
        onDismiss();
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
            <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={{ backgroundColor: '#0f172a', margin: 20, borderRadius: 12, borderWidth: 1, borderColor: '#334155' }}>
                <View className="p-4 border-b border-slate-700 bg-slate-800 rounded-t-xl">
                    <Text variant="titleMedium" className="font-bold text-white">Enter Score</Text>
                </View>

                <View className="p-6 bg-slate-900">
                    <View className="flex-row justify-between items-center mb-4 gap-4">
                        <View className="flex-1">
                            <Text className="text-white font-bold mb-2 text-center h-10" numberOfLines={2}>{team1Name}</Text>
                            <TextInput
                                value={score1}
                                onChangeText={setScore1}
                                keyboardType="number-pad"
                                mode="outlined"
                                className="bg-slate-800 text-center"
                                theme={inputTheme}
                                style={{ textAlign: 'center' }}
                            />
                        </View>
                        <Text className="text-slate-500 font-bold pt-6">VS</Text>
                        <View className="flex-1">
                            <Text className="text-white font-bold mb-2 text-center h-10" numberOfLines={2}>{team2Name}</Text>
                            <TextInput
                                value={score2}
                                onChangeText={setScore2}
                                keyboardType="number-pad"
                                mode="outlined"
                                className="bg-slate-800 text-center"
                                theme={inputTheme}
                                style={{ textAlign: 'center' }}
                            />
                        </View>
                    </View>
                    {error ? <HelperText type="error" visible={true} className="text-center">{error}</HelperText> : null}
                </View>

                <View className="p-4 border-t border-slate-700 bg-slate-800 rounded-b-xl flex-row justify-end gap-2">
                    <Button onPress={onDismiss} textColor="#94a3b8">Cancel</Button>
                    <Button mode="contained" onPress={handleSave} buttonColor="#5b7cfa" textColor="white">Save Score</Button>
                </View>
            </Modal>
        </Portal>
    );
};

export default ScoreModal;
