import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import DashboardLayout from './components/DashboardLayout';
import Leagues from './pages/Leagues';
import Players from './pages/Players';
import LeagueDetails from './pages/LeagueDetails';
import SessionDetails from './pages/SessionDetails';
import HighRollers from './pages/HighRollers';
import Calendar from './pages/Calendar';
import Chat from './pages/Chat';
import HomeRedirect from './pages/HomeRedirect';
import JoinClub from './pages/JoinClub';
import ClubInvite from './pages/ClubInvite';
import { ClubProvider } from './contexts/ClubContext';
import { Outlet } from 'react-router-dom';
import ClubDashboard from './pages/ClubDashboard';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Root Route: Redirects or shows generic dashboard */}
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/join/:clubId" element={<Layout><JoinClub /></Layout>} />

            {/* Club Routes (With Club Context) */}
            <Route path="/clubs/:clubId" element={
              <ClubProvider>
                <DashboardLayout>
                  <Outlet />
                </DashboardLayout>
              </ClubProvider>
            }>
              <Route path="leagues" element={<Leagues />} />
              <Route path="players" element={<Players />} />
              <Route path="high-rollers" element={<HighRollers />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="chat" element={<Chat />} />
              <Route path="leagues/:id" element={<LeagueDetails />} />
              <Route path="leagues/:leagueId/sessions/:sessionId" element={<SessionDetails />} />
              <Route path="invite" element={<ClubInvite />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
