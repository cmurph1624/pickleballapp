import React, { useState, useEffect } from 'react';
import { Calendar as BigCalendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Paper } from '@mui/material';
import { CalendarMonth } from '@mui/icons-material';

const locales = {
    'en-US': enUS,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

const Calendar = () => {
    const [events, setEvents] = useState([]);
    const [date, setDate] = useState(new Date());
    const [view, setView] = useState('month');
    const navigate = useNavigate();

    useEffect(() => {
        const q = query(collection(db, 'weeks'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const weeks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const calendarEvents = weeks
                .filter(week => week.scheduledDate) // Only show weeks with a date
                .map(week => {
                    const startDate = new Date(week.scheduledDate);
                    // Default duration 2 hours if not specified, or just end at same time
                    const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

                    return {
                        id: week.id,
                        title: week.name,
                        start: startDate,
                        end: endDate,
                        resource: week
                    };
                });

            setEvents(calendarEvents);
        });

        return () => unsubscribe();
    }, []);

    const handleSelectEvent = (event) => {
        const week = event.resource;
        navigate(`/leagues/${week.leagueId}/weeks/${week.id}`);
    };

    const onNavigate = (newDate) => {
        setDate(newDate);
    };

    const onView = (newView) => {
        setView(newView);
    };

    return (
        <Box sx={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarMonth fontSize="large" color="primary" />
                League Calendar
            </Typography>
            <Paper sx={{ flexGrow: 1, p: 2 }}>
                <BigCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    onSelectEvent={handleSelectEvent}
                    views={['month', 'week', 'day', 'agenda']}
                    defaultView="month"
                    date={date}
                    view={view}
                    onNavigate={onNavigate}
                    onView={onView}
                />
            </Paper>
        </Box>
    );
};

export default Calendar;
