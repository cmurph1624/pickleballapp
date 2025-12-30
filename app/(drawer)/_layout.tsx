import CustomDrawerContent from '@/components/CustomDrawerContent';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Drawer } from 'expo-router/drawer';
import React from 'react';

export default function DrawerLayout() {
  const colorScheme = useColorScheme();

  return (
    <Drawer
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#1e293b' : '#ffffff', // slate-800 or white
        },
        headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#000000',
        drawerActiveTintColor: '#2f95dc',
      }}
    >
      <Drawer.Screen
        name="dashboard"
        options={{
          drawerLabel: 'Dashboard',
          title: 'Dashboard',
        }}
      />
      <Drawer.Screen
        name="schedule"
        options={{
          drawerLabel: 'Schedule',
          title: 'Schedule',
          drawerItemStyle: { display: 'none' } // Hidden, accessed via Club > Calendar in sidebar
        }}
      />
      <Drawer.Screen
        name="leagues"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Leagues'
        }}
      />
      <Drawer.Screen
        name="players"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'Players'
        }}
      />
      <Drawer.Screen
        name="high-rollers"
        options={{
          drawerItemStyle: { display: 'none' },
          title: 'High Rollers'
        }}
      />
    </Drawer>
  );
}
