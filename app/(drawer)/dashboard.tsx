import React from 'react';
import { ScrollView, View } from 'react-native';
import { Avatar, Button, Card, Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
// import { useClub } from '../../contexts/ClubContext'; // If needed for club data

export default function DashboardScreen() {
  const { currentUser, logout } = useAuth();
  const theme = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-gray-100 dark:bg-slate-900" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text variant="headlineMedium" className="font-bold">Dashboard</Text>
            <Text variant="bodyMedium" className="text-gray-600 dark:text-gray-400">
              Welcome back, {currentUser?.email?.split('@')[0]}
            </Text>
          </View>
          <Avatar.Text size={40} label={currentUser?.email?.[0].toUpperCase() || "U"} />
        </View>

        {/* Balance Card */}
        <Card className="mb-4 bg-white dark:bg-slate-800">
          <Card.Content>
            <Text variant="titleMedium" className="text-gray-500">Wallet Balance</Text>
            <Text variant="displaySmall" className="font-bold mt-1">
              ${currentUser?.walletBalance || 0}
            </Text>
          </Card.Content>
        </Card>

        {/* Quick Actions */}
        <View className="flex-row mb-6 gap-2">
          <Button
            mode="contained"
            onPress={() => console.log('Find Match')}
            className="flex-1"
          >
            Find Match
          </Button>
          <Button
            mode="outlined"
            onPress={() => console.log('My Stats')}
            className="flex-1"
          >
            My Stats
          </Button>
        </View>

        {/* Upcoming Sessions Placeholder */}
        <Text variant="titleLarge" className="mb-3 font-semibold">Upcoming Sessions</Text>
        <Card className="mb-4 bg-white dark:bg-slate-800">
          <Card.Content>
            <Text variant="bodyMedium">No upcoming sessions scheduled.</Text>
            <Button mode="text" className="mt-2">View Schedule</Button>
          </Card.Content>
        </Card>

        {/* Recent Activity Placeholder */}
        <Text variant="titleLarge" className="mb-3 font-semibold">Recent Activity</Text>
        <Card className="mb-6 bg-white dark:bg-slate-800">
          <Card.Content>
            <Text variant="bodyMedium">No recent matches.</Text>
          </Card.Content>
        </Card>

        <Button mode="outlined" onPress={logout} icon="logout">
          Sign Out
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
