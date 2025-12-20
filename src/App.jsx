import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import Leagues from './pages/Leagues';
import Players from './pages/Players';
import LeagueDetails from './pages/LeagueDetails';
import WeekDetails from './pages/WeekDetails';
import HighRollers from './pages/HighRollers';
import Calendar from './pages/Calendar';
import Chat from './pages/Chat';
import HomeRedirect from './pages/HomeRedirect';
import JoinClub from './pages/JoinClub';
import ClubInvite from './pages/ClubInvite';
import { ClubProvider } from './contexts/ClubContext';
import { Outlet } from 'react-router-dom';
import ClubDashboard from './pages/ClubDashboard'; // Needed for redirect logic if fallback used, though HomeRedirect handles it. Kept for safety.

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Root Route: Redirects or shows generic dashboard */}
            <Route path="/" element={<Layout><HomeRedirect /></Layout>} />
            <Route path="/join/:clubId" element={<Layout><JoinClub /></Layout>} />

            {/* Club Routes (With Club Context) */}
            <Route path="/clubs/:clubId" element={
              <ClubProvider>
                <Layout>
                  <Outlet />
                </Layout>
              </ClubProvider>
            }>
              <Route path="leagues" element={<Leagues />} />
              <Route path="players" element={<Players />} />
              <Route path="high-rollers" element={<HighRollers />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="chat" element={<Chat />} />
              <Route path="leagues/:id" element={<LeagueDetails />} />
              <Route path="leagues/:leagueId/weeks/:weekId" element={<WeekDetails />} />
              <Route path="invite" element={<ClubInvite />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
