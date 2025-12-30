import { useLocalSearchParams } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { ActivityIndicator, Card, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { db } from '../../firebase';

export default function ScheduleScreen() {
  const [selected, setSelected] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [markedDates, setMarkedDates] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const { clubId } = useLocalSearchParams();
  const theme = useTheme();

  useEffect(() => {
    if (!clubId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'sessions'),
      where('clubId', '==', clubId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSessions(sessionsData);

      const marks: any = {};
      sessionsData.forEach((session: any) => {
        if (session.scheduledDate) {
          // Ensure date format matches YYYY-MM-DD
          const dateKey = session.scheduledDate.split('T')[0];
          marks[dateKey] = { marked: true, dotColor: theme.colors.primary };
        }
      });
      setMarkedDates(marks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [clubId]);

  const selectedSessions = sessions.filter(session => {
    if (!selected || !session.scheduledDate) return false;
    return session.scheduledDate.startsWith(selected);
  });

  const renderItem = ({ item }: { item: any }) => (
    <Card className="mb-2 bg-white dark:bg-slate-800" onPress={() => console.log('View Session', item.id)}>
      <Card.Content>
        <Text variant="titleMedium" className="font-bold">{item.name || 'Unnamed Session'}</Text>
        <Text variant="bodySmall" className="text-gray-500">
          {new Date(item.scheduledDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        {item.courtNames && (
          <Text variant="bodySmall" className="mt-1">
            Courts: {item.courtNames.join(', ')}
          </Text>
        )}
        <Text variant="bodySmall" className="mt-1 text-primary">
          {item.players ? `${item.players.length} Players` : 'No players'}
        </Text>
      </Card.Content>
    </Card>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-100 dark:bg-slate-900" edges={['top', 'left', 'right']}>
      <View className="flex-1 p-4">
        <Text variant="headlineMedium" className="mb-4 font-bold">Schedule</Text>

        <Card className="mb-4 bg-white dark:bg-slate-800">
          <Calendar
            onDayPress={day => {
              setSelected(day.dateString);
            }}
            markedDates={{
              ...markedDates,
              [selected]: {
                selected: true,
                disableTouchEvent: true,
                selectedDotColor: 'white',
                ...(markedDates[selected] || {})
              }
            }}
            theme={{
              calendarBackground: 'transparent',
              textSectionTitleColor: '#b6c1cd',
              selectedDayBackgroundColor: theme.colors.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: theme.colors.secondary,
              dayTextColor: '#2d4150',
              textDisabledColor: '#d9e1e8',
              arrowColor: theme.colors.primary,
              dotColor: theme.colors.primary,
            }}
          />
        </Card>

        <Text variant="titleMedium" className="mb-2">Events on {selected || 'Selected Date'}</Text>

        {loading ? (
          <ActivityIndicator className="mt-4" />
        ) : (
          <FlatList
            data={selectedSessions}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            ListEmptyComponent={
              <Card className="bg-white dark:bg-slate-800 p-4">
                <Text className="text-gray-500 text-center">No events found for this date.</Text>
              </Card>
            }
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
