import React, { useState, useEffect } from 'react';
import { Box, List, ListItem, ListItemButton, ListItemText, Typography, Divider, Avatar, Badge } from '@mui/material';
import { Tag, Person } from '@mui/icons-material';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const ChannelList = ({ selectedChannelId, onSelectChannel }) => {
    const { currentUser } = useAuth();
    const [channels, setChannels] = useState([
        { id: 'general', name: 'General', type: 'public' },
        { id: 'trash-talk', name: 'Trash Talk', type: 'public' },
        { id: 'announcements', name: 'Announcements', type: 'public' }
    ]);
    const [dms, setDms] = useState([]);
    const [users, setUsers] = useState({});

    // Fetch users for DM names
    useEffect(() => {
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const usersData = {};
            snapshot.docs.forEach(doc => {
                usersData[doc.id] = doc.data();
            });
            setUsers(usersData);
        });
        return () => unsubscribe();
    }, []);

    // Fetch DMs (channels where type is 'dm' and currentUser is a member)
    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, 'channels'),
            where('type', '==', 'dm'),
            where('members', 'array-contains', currentUser.uid)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const dmList = snapshot.docs.map(doc => {
                const data = doc.data();
                // Find the other user
                const otherUserId = data.members.find(id => id !== currentUser.uid);
                const otherUser = users[otherUserId];
                return {
                    id: doc.id,
                    ...data,
                    name: otherUser ? (otherUser.displayName || 'Unknown User') : 'Unknown User',
                    photoURL: otherUser?.photoURL
                };
            });
            setDms(dmList);
        });

        return () => unsubscribe();
    }, [currentUser, users]);

    return (
        <Box sx={{ height: '100%', overflowY: 'auto' }}>
            <Box sx={{ p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Channels</Typography>
            </Box>
            <List>
                {channels.map(channel => (
                    <ListItem key={channel.id} disablePadding>
                        <ListItemButton
                            selected={selectedChannelId === channel.id}
                            onClick={() => onSelectChannel(channel)}
                        >
                            <Tag sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />
                            <ListItemText primary={channel.name} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>

            <Divider />

            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Direct Messages</Typography>
                {/* Add New DM Button could go here */}
            </Box>
            <List>
                {dms.map(dm => (
                    <ListItem key={dm.id} disablePadding>
                        <ListItemButton
                            selected={selectedChannelId === dm.id}
                            onClick={() => onSelectChannel(dm)}
                        >
                            <Avatar
                                src={dm.photoURL}
                                sx={{ width: 24, height: 24, mr: 1 }}
                            >
                                <Person fontSize="small" />
                            </Avatar>
                            <ListItemText primary={dm.name} />
                        </ListItemButton>
                    </ListItem>
                ))}
                {dms.length === 0 && (
                    <ListItem>
                        <Typography variant="body2" color="text.secondary">No active DMs</Typography>
                    </ListItem>
                )}
            </List>
        </Box>
    );
};

export default ChannelList;
