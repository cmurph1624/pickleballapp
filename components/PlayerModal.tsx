import { addDoc, collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Button, HelperText, Modal, Portal, SegmentedButtons, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';

interface PlayerModalProps {
    visible: boolean;
    onDismiss: () => void;
    player?: any;
}

const PlayerModal = ({ visible, onDismiss, player }: PlayerModalProps) => {
    const theme = useTheme();
    const { currentUser } = useAuth();

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [gender, setGender] = useState('Male');
    const [duprDoubles, setDuprDoubles] = useState('');
    const [duprSingles, setDuprSingles] = useState('');
    const [linkedUserEmail, setLinkedUserEmail] = useState('');

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible) {
            if (player) {
                setFirstName(player.firstName);
                setLastName(player.lastName);
                setGender(player.gender);
                setDuprDoubles(player.duprDoubles?.toString() || '');
                setDuprSingles(player.duprSingles?.toString() || '');
                setLinkedUserEmail(player.linkedUserEmail || '');
            } else {
                setFirstName('');
                setLastName('');
                setGender('Male');
                setDuprDoubles('');
                setDuprSingles('');
                setLinkedUserEmail('');
            }
        }
    }, [visible, player]);

    const handleSubmit = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            Alert.alert("Error", "First and Last Name are required.");
            return;
        }

        setLoading(true);

        const data: any = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            gender: gender,
            duprDoubles: parseFloat(duprDoubles) || null,
            duprSingles: parseFloat(duprSingles) || null,
            linkedUserEmail: linkedUserEmail ? linkedUserEmail.trim().toLowerCase() : null,
            updatedAt: new Date()
        };

        if (data.linkedUserEmail) {
            const searchEmail = data.linkedUserEmail;
            const q = query(collection(db, 'users'), where('email', '==', searchEmail));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userDoc = querySnapshot.docs[0];
                data.linkedUserId = userDoc.id;
            } else {
                Alert.alert("Warning", `No user found with email "${data.linkedUserEmail}". The email will be saved, but no link created.`);
            }
        }

        try {
            if (player) {
                await updateDoc(doc(db, 'players', player.id), data);
            } else {
                data.createdAt = new Date();
                data.createdBy = currentUser ? currentUser.uid : 'anonymous';
                const dupr = data.duprDoubles || 3.5;
                data.hiddenRating = dupr * 10;
                await addDoc(collection(db, 'players'), data);
            }
            onDismiss();
        } catch (error: any) {
            console.error("Error saving player:", error);
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
                    <Text variant="titleLarge" className="font-bold text-white">{player ? 'Edit Player' : 'Add Player'}</Text>
                </View>

                <ScrollView className="p-4 bg-slate-900">
                    <View className="flex-row gap-2 mb-2">
                        <TextInput
                            label="First Name"
                            value={firstName}
                            onChangeText={setFirstName}
                            mode="outlined"
                            style={{ flex: 1 }}
                            className="bg-slate-800"
                            textColor="white"
                            theme={inputTheme}
                        />
                        <TextInput
                            label="Last Name"
                            value={lastName}
                            onChangeText={setLastName}
                            mode="outlined"
                            style={{ flex: 1 }}
                            className="bg-slate-800"
                            textColor="white"
                            theme={inputTheme}
                        />
                    </View>

                    <Text className="mb-2 font-bold mt-2 text-white">Gender</Text>
                    <SegmentedButtons
                        value={gender}
                        onValueChange={setGender}
                        buttons={[
                            { value: 'Male', label: 'Male', style: { backgroundColor: gender === 'Male' ? '#5b7cfa' : '#1e293b', borderColor: '#334155' }, labelStyle: { color: gender === 'Male' ? 'white' : '#94a3b8' } },
                            { value: 'Female', label: 'Female', style: { backgroundColor: gender === 'Female' ? '#5b7cfa' : '#1e293b', borderColor: '#334155' }, labelStyle: { color: gender === 'Female' ? 'white' : '#94a3b8' } },
                        ]}
                        className="mb-4"
                        theme={{ colors: { secondaryContainer: '#5b7cfa', onSecondaryContainer: 'white' } }}
                    />

                    <View className="flex-row gap-2 mb-2">
                        <TextInput
                            label="DUPR (Doubles)"
                            value={duprDoubles}
                            onChangeText={setDuprDoubles}
                            mode="outlined"
                            keyboardType="numeric"
                            style={{ flex: 1 }}
                            className="bg-slate-800"
                            textColor="white"
                            theme={inputTheme}
                        />
                        <TextInput
                            label="DUPR (Singles)"
                            value={duprSingles}
                            onChangeText={setDuprSingles}
                            mode="outlined"
                            keyboardType="numeric"
                            style={{ flex: 1 }}
                            className="bg-slate-800"
                            textColor="white"
                            theme={inputTheme}
                        />
                    </View>

                    <TextInput
                        label="Linked User Email"
                        value={linkedUserEmail}
                        onChangeText={setLinkedUserEmail}
                        mode="outlined"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        className="mb-1 bg-slate-800"
                        textColor="white"
                        theme={inputTheme}
                    />
                    <HelperText type="info" style={{ color: '#94a3b8' }}>
                        Link to an existing app user account.
                    </HelperText>

                </ScrollView>

                <View className="p-4 border-t border-slate-700 bg-slate-800 rounded-b-xl flex-row justify-end gap-2">
                    <Button onPress={onDismiss} textColor="#94a3b8">Cancel</Button>
                    <Button mode="contained" onPress={handleSubmit} loading={loading} buttonColor="#5b7cfa" textColor="white">Save</Button>
                </View>
            </Modal>
        </Portal>
    );
};

export default PlayerModal;
