import React, { useState } from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Avatar, Container, IconButton, Drawer, List, ListItem, ListItemIcon, ListItemText, Divider, Tooltip, Collapse, ListItemButton, useMediaQuery, useTheme } from '@mui/material';
import { Menu as MenuIcon, EmojiEvents, People, AttachMoney, ChevronLeft, PushPin, PushPinOutlined, CalendarMonth, ExpandLess, ExpandMore, Add as AddIcon, Dashboard } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const DRAWER_WIDTH = 250;

const Layout = ({ children }) => {
    const { currentUser, login, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(false);

    // Default to pinned on desktop (run once or when media query changes significantly if we want adaptive)
    // We use a ref to track if we've already set the default so we don't override user choice on resize
    const initializedRef = React.useRef(false);

    React.useEffect(() => {
        if (!initializedRef.current && isDesktop) {
            setIsPinned(true);
            setDrawerOpen(true);
            initializedRef.current = true;
        }
    }, [isDesktop]);

    const handleLogout = async () => {
        try {
            await logout();
            setDrawerOpen(false);
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const [myClubs, setMyClubs] = useState([]);
    const [expandedClubId, setExpandedClubId] = useState(null);
    const { clubId } = useParams(); // Restore missing variable

    // Fetch user's clubs
    React.useEffect(() => {
        if (!currentUser) {
            setMyClubs([]);
            return;
        }

        const q = query(collection(db, 'clubs'), where('members', 'array-contains', currentUser.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const clubsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMyClubs(clubsData);

            // If we have a clubId in URL, expand that one by default
            if (clubId) setExpandedClubId(clubId);
            // If not, and we have clubs, maybe expand the first one?
            else if (clubsData.length > 0 && !expandedClubId) setExpandedClubId(clubsData[0].id);
        });

        return () => unsubscribe();
    }, [currentUser, clubId]);

    const handleClubClick = (id) => {
        setExpandedClubId(expandedClubId === id ? null : id);
    };

    const toggleDrawer = (open) => (event) => {
        if (event && event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
            return;
        }
        // If pinned, don't close via toggle (unless explicitly handling unpin, which is separate)
        if (isPinned && !open) return;

        setDrawerOpen(open);
    };

    const handlePinToggle = () => {
        setIsPinned(!isPinned);
        // If we are pinning, ensure it's open. If unpinning, it stays open until manually closed or clicked away (if temporary)
        if (!isPinned) setDrawerOpen(true);
    };

    const drawerList = (
        <Box
            sx={{ width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column', height: '100%' }}
            role="presentation"
        // Only handle clicks for closing if NOT pinned AND not clicking a collapse toggle (prevent closure on menu interaction)
        // Actually, keep simple: Close on navigation (List Item Click), not on header click
        >
            {!isPinned && <Toolbar />}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1, bgcolor: 'action.hover' }}>
                <Tooltip title={isPinned ? "Unpin Menu" : "Pin Menu Open"}>
                    <Button
                        onClick={(e) => {
                            e.stopPropagation();
                            handlePinToggle();
                        }}
                        startIcon={isPinned ? <PushPin /> : <PushPinOutlined />}
                        size="small"
                    >
                        {isPinned ? "Unpin" : "Pin"}
                    </Button>
                </Tooltip>
                <IconButton
                    onClick={(e) => {
                        e.stopPropagation();
                        setDrawerOpen(false);
                        if (isPinned) setIsPinned(false);
                    }}
                >
                    <ChevronLeft />
                </IconButton>
            </Box>
            <Divider />

            <Divider />

            {/* Main content grows to push bottom content down */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                <List>
                    {/* Global Dashboard Link */}
                    <ListItemButton onClick={() => {
                        navigate('/');
                        if (!isPinned) setDrawerOpen(false);
                    }}>
                        <ListItemIcon>
                            <Dashboard />
                        </ListItemIcon>
                        <ListItemText primary="Dashboard" primaryTypographyProps={{ fontWeight: 'bold' }} />
                    </ListItemButton>
                    <Divider sx={{ my: 1 }} />

                    {myClubs.map((club) => {
                        const isExpanded = expandedClubId === club.id;
                        const isActive = clubId === club.id;

                        return (
                            <React.Fragment key={club.id}>
                                <ListItemButton onClick={() => handleClubClick(club.id)} selected={isActive}>
                                    <ListItemText primary={club.name} primaryTypographyProps={{ fontWeight: 'bold' }} />
                                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                </ListItemButton>
                                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                                    <List component="div" disablePadding>
                                        {[
                                            { text: 'Leagues', icon: <EmojiEvents />, path: `/clubs/${club.id}/leagues` },
                                            { text: 'Players', icon: <People />, path: `/clubs/${club.id}/players` },
                                            { text: 'High Rollers', icon: <AttachMoney />, path: `/clubs/${club.id}/high-rollers` },
                                            { text: 'Calendar', icon: <CalendarMonth />, path: `/clubs/${club.id}/calendar` },
                                        ].map((item) => (
                                            <ListItemButton
                                                key={item.text}
                                                sx={{ pl: 4 }}
                                                onClick={() => {
                                                    navigate(item.path);
                                                    if (!isPinned) setDrawerOpen(false);
                                                }}
                                                selected={location.pathname === item.path}
                                            >
                                                <ListItemIcon sx={{ minWidth: 40 }}>
                                                    {item.icon}
                                                </ListItemIcon>
                                                <ListItemText primary={item.text} />
                                            </ListItemButton>
                                        ))}
                                    </List>
                                </Collapse>
                            </React.Fragment>
                        );
                    })}
                </List>
            </Box>

            <Divider />

            {/* New Club Button - Pushed to Bottom */}
            <Box sx={{ p: 2, mt: 'auto' }}>
                <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<AddIcon />}
                    onClick={() => {
                        navigate('/');
                    }}
                >
                    Manage / Create
                </Button>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    {currentUser && !isPinned && (
                        <IconButton
                            size="large"
                            edge="start"
                            color="inherit"
                            aria-label="menu"
                            sx={{ mr: 2 }}
                            onClick={toggleDrawer(true)}
                        >
                            <MenuIcon />
                        </IconButton>
                    )}
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        Pickleball League
                    </Typography>
                    {currentUser ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar src={currentUser.photoURL} alt={currentUser.displayName} sx={{ width: 32, height: 32 }} />
                            <Button color="inherit" onClick={handleLogout}>Logout</Button>
                        </Box>
                    ) : (
                        <Button color="inherit" onClick={login}>Login</Button>
                    )}
                </Toolbar>
            </AppBar>

            <Drawer
                variant={isPinned ? "persistent" : "temporary"}
                anchor="left"
                open={drawerOpen}
                onClose={toggleDrawer(false)}
                sx={{
                    width: isPinned ? DRAWER_WIDTH : undefined,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: DRAWER_WIDTH,
                        boxSizing: 'border-box',
                        top: isPinned ? 64 : 0, // Adjust for AppBar height if persistent
                        height: isPinned ? 'calc(100% - 64px)' : '100%'
                    },
                }}
            >
                {drawerList}
            </Drawer>

            <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, width: isPinned ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%' }}>
                {children}
            </Box>
        </Box>
    );
};

export default Layout;
