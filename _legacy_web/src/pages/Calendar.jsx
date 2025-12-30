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

import { useClub } from '../contexts/ClubContext';

const Calendar = () => {
    const [events, setEvents] = useState([]);
    const [date, setDate] = useState(new Date());
    const [view, setView] = useState('month');
    const navigate = useNavigate();
    const { clubId } = useClub();

    useEffect(() => {
        const q = query(collection(db, 'sessions'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const calendarEvents = sessions
                .filter(session => session.scheduledDate)
                .map(session => {
                    const startDate = new Date(session.scheduledDate);
                    const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000));

                    return {
                        id: session.id,
                        title: session.name,
                        start: startDate,
                        end: endDate,
                        resource: session
                    };
                });

            setEvents(calendarEvents);
        });

        return () => unsubscribe();
    }, []);

    const handleSelectEvent = (event) => {
        const session = event.resource;
        if (clubId && session.leagueId) {
            navigate(`/clubs/${clubId}/leagues/${session.leagueId}/sessions/${session.id}`);
        }
    };

    const onNavigate = (newDate) => {
        setDate(newDate);
    };

    const onView = (newView) => {
        setView(newView);
    };

    return (
        <div className="w-full flex flex-col h-[calc(100vh-120px)]">
            <style>{`
                /* Toolbar */
                .rbc-toolbar {
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .rbc-toolbar-label {
                    color: inherit;
                    font-size: 1.25rem;
                    font-weight: 700;
                    text-transform: capitalize;
                }
                .rbc-btn-group {
                    box-shadow: none;
                    border: 1px solid #374151; /* gray-700 */
                    border-radius: 0.5rem;
                    overflow: hidden;
                }
                .rbc-btn-group > button {
                    color: inherit;
                    border: none;
                    border-right: 1px solid #374151;
                    padding: 8px 16px;
                    font-weight: 500;
                    cursor: pointer;
                    background-color: transparent;
                }
                .rbc-btn-group > button:last-child {
                    border-right: none;
                }
                .rbc-btn-group > button:hover {
                    background-color: rgba(255,255,255, 0.1);
                }
                .rbc-btn-group > button.rbc-active {
                    background-color: #9333ea; /* PURPLE */
                    color: white;
                    box-shadow: none;
                }
                .dark .rbc-btn-group > button.rbc-active {
                    background-color: #9333ea; /* PURPLE */
                }

                /* Month View */
                .rbc-month-view {
                    border: 1px solid #374151;
                    border-radius: 0.75rem;
                    overflow: hidden;
                    background-color: transparent;
                }
                .rbc-header {
                    border-bottom: 1px solid #374151;
                    padding: 8px;
                    font-weight: 600;
                    color: inherit;
                    text-transform: uppercase;
                    font-size: 0.875rem;
                    letter-spacing: 0.05em;
                }
                .rbc-header + .rbc-header {
                    border-left: 1px solid #374151;
                }
                .rbc-month-row + .rbc-month-row {
                    border-top: 1px solid #374151;
                }
                .rbc-day-bg + .rbc-day-bg {
                    border-left: 1px solid #374151;
                }
                .rbc-off-range-bg {
                    background-color: rgba(0,0,0,0.2) !important;
                }
                .dark .rbc-off-range-bg {
                    background-color: rgba(0,0,0,0.4) !important;
                }
                
                /* Today Cell */
                .rbc-today {
                    background-color: rgba(255, 255, 255, 0.1) !important; /* Light grey/transparent */
                }

                /* Dates */
                .rbc-date-cell {
                    padding: 8px;
                    font-weight: 500;
                    color: inherit;
                    opacity: 0.7;
                }
                .rbc-now {
                    color: #9333ea; /* PURPLE */
                    font-weight: 800;
                }
                .rbc-current .rbc-button-link {
                    color: #9333ea; /* PURPLE */
                }

                /* Events */
                .rbc-event {
                    background-color: #9333ea; /* PURPLE */
                    border: none;
                    border-radius: 4px;
                    padding: 4px 8px;
                    font-size: 0.85rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    transition: transform 0.1s;
                }
                .rbc-event:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                }
                .rbc-event-label {
                    display: none;
                }

                /* Dark Mode Text Fixes */
                .dark .rbc-calendar {
                    color: #e5e7eb;
                }
            `}</style>

            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white flex items-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-purple-600">calendar_month</span>
                    League Calendar
                </h1>
            </div>

            <div className="flex-1 bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <BigCalendar
                    localizer={localizer}
                    events={events}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height: '100%' }}
                    onSelectEvent={handleSelectEvent}
                    views={['month', 'week', 'agenda']}
                    defaultView="month"
                    date={date}
                    view={view}
                    onNavigate={onNavigate}
                    onView={onView}
                />
            </div>
        </div>
    );
};

export default Calendar;
