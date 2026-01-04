import React, { useState } from 'react';
import { Badge, IconButton, Menu, MenuItem, Typography, Box, ListItemText, Divider, Button } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNotifications } from '../contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

const NotificationBell = () => {
    const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications, removeNotification } = useNotifications();
    const [anchorEl, setAnchorEl] = useState(null);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleNotificationClick = (id) => {
        markAsRead(id);
        // Optional: navigation logic here if notification has a link
    };

    const open = Boolean(anchorEl);

    return (
        <>
            <IconButton color="inherit" onClick={handleClick}>
                <Badge badgeContent={unreadCount} color="error">
                    <NotificationsIcon />
                </Badge>
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    style: {
                        maxHeight: 400,
                        width: 350,
                    },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Notifications</Typography>
                    {notifications.length > 0 && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <Button size="small" onClick={markAllAsRead}>Mark all read</Button>
                            <Button size="small" color="error" onClick={clearNotifications}>Clear all</Button>
                        </div>
                    )}
                </Box>
                <Divider />
                {notifications.length === 0 ? (
                    <MenuItem disabled>
                        <Typography variant="body2" color="textSecondary">
                            No new notifications
                        </Typography>
                    </MenuItem>
                ) : (
                    notifications.map((notification) => (
                        <MenuItem
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification.id)}
                            sx={{
                                backgroundColor: notification.read ? 'transparent' : 'action.hover',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                whiteSpace: 'normal', // Allow text wrapping
                            }}
                        >
                            <ListItemText
                                primary={notification.message}
                                secondary={
                                    <Typography variant="caption" color="text.secondary">
                                        {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                                    </Typography>
                                }
                            />
                        </MenuItem>
                    ))
                )}
            </Menu>
        </>
    );
};

export default NotificationBell;
