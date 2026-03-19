import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ServiceProvider } from "./contexts/ServiceContext";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import ChannelFeatured from "./components/ChannelFeatured";
import FullscreenPlayer from "./components/FullscreenPlayer";
import EPGGrid from "./components/EPGGrid";
import LoginPage from "./components/LoginPage";
import AdminDashboard from "./components/AdminDashboard";
import SetupWizard from "./components/SetupWizard";
import OnDemandPage from "./components/OnDemandPage";
import HomePage from "./components/HomePage";
import UserSettingsPage from "./components/UserSettingsPage";
import AppInfoPage from "./components/AppInfoPage";
import { VersionPopup } from "./components/AppInfoPage";
import RecordingsPage from "./components/RecordingsPage";
import NotificationsPage from "./components/NotificationsPage";
import ControlsHint from "./components/ControlsHint";
import ActivatePage from "./pages/ActivatePage";
import PortalLayout from "./pages/PortalLayout";
import PortalHome from "./pages/PortalHome";
import PortalFAQ from "./pages/PortalFAQ";
import PortalSupport from "./pages/PortalSupport";
import PortalStatus from "./pages/PortalStatus";
import RegisterPage from "./pages/RegisterPage";
import CustomerLoginPage from "./pages/CustomerLoginPage";
import MyAccountPage from "./pages/MyAccountPage";
import { Toaster } from "./components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const period = hour >= 12 ? 'p.m.' : 'a.m.';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      slots.push(`${displayHour}:${min.toString().padStart(2, '0')} ${period}`);
    }
  }
  return slots;
};

const timeSlots = generateTimeSlots();

const GuideView = ({ onViewChange }) => {
  const [channels, setChannels] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [playingChannel, setPlayingChannel]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [chRes, prRes] = await Promise.all([
          axios.get(`${API}/channels`),
          axios.get(`${API}/programs`)
        ]);
        setChannels(chRes.data);
        if (chRes.data.length > 0) setSelectedChannel(chRes.data[0]);
        setPrograms(prRes.data);
      } catch (e) {
        console.error('Error fetching guide data:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const getCurrentProgram = useCallback((channelId) => {
    if (!channelId || programs.length === 0) return null;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nowTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const chProgs = programs.filter(p => p.channel_id === channelId && p.date === todayStr);
    return chProgs.find(p => p.start_time <= nowTime) || chProgs[0] || null;
  }, [programs]);

  // Called when user clicks a channel card or presses OK — go straight to fullscreen
  const handleChannelPlay = useCallback((channel) => {
    if (!channel || channel.coming_soon) return;
    if (channel.channel_type === 'vod') { onViewChange('ondemand', 'movie'); return; }
    setSelectedChannel(channel);
    setPlayingChannel(channel);
  }, [onViewChange]);

  if (loading) {
    return (
      <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-white text-2xl">Loading guide...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#1a1a1a] overflow-y-auto">
      {/* Fullscreen player — no controls, ESC/back to exit */}
      {playingChannel && (
        <FullscreenPlayer
          channel={playingChannel}
          currentProgram={getCurrentProgram(playingChannel.id)}
          channels={channels}
          getProgram={getCurrentProgram}
          onClose={() => setPlayingChannel(null)}
        />
      )}
      <TopBar />
      <div className="pt-16 pl-8 pr-6 py-6">
        {selectedChannel && (
          <ChannelFeatured
            channel={selectedChannel}
            currentProgram={getCurrentProgram(selectedChannel.id)}
            onViewChange={onViewChange}
          />
        )}
        {channels.length > 0 ? (
          <EPGGrid
            channels={channels}
            programs={programs}
            timeSlots={timeSlots}
            selectedChannelId={selectedChannel?.id}
            onChannelSelect={setSelectedChannel}
            onChannelPlay={handleChannelPlay}
            onViewChange={onViewChange}
          />
        ) : (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-xl">No channels available</p>
            <p className="text-sm mt-2">Contact administrator to add channels</p>
          </div>
        )}
      </div>
    </div>
  );
};

const Home = () => {
  const [activeView, setActiveView] = useState('guide');
  const [onDemandFilter, setOnDemandFilter] = useState('all');
  const navigate = useNavigate();

  const handleViewChange = (viewId, filter = 'all') => {
    if (viewId === 'settings') {
      navigate('/admin');
      return;
    }
    if (viewId === 'ondemand') setOnDemandFilter(filter);
    setActiveView(viewId);
  };

  const renderView = () => {
    switch (activeView) {
      case 'guide':
        return <GuideView onViewChange={handleViewChange} />;
      case 'ondemand':
        return <OnDemandPage onBack={() => { setActiveView('guide'); setOnDemandFilter('all'); }} defaultCategory={onDemandFilter} />;
      case 'recordings':
        return <RecordingsPage userId={null} onBack={() => setActiveView('guide')} />;
      case 'notifications':
        return <NotificationsPage onBack={() => setActiveView('guide')} />;
      case 'home':
        return <HomePage onViewChange={handleViewChange} />;
      case 'user-settings':
        return <UserSettingsPage />;
      case 'app-info':
        return <AppInfoPage />;
      case 'saved':
        return (
          <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center">
            <div className="text-center">
              <p className="text-white text-2xl mb-2">Saved</p>
              <p className="text-gray-400 text-sm">Your saved programs will appear here</p>
              <button onClick={() => setActiveView('guide')} className="mt-6 text-[#0056A8] hover:underline text-sm">← Back to Guide</button>
            </div>
          </div>
        );
      default:
        return <GuideView onViewChange={handleViewChange} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#1a1a1a]">
      <VersionPopup />
      <ControlsHint />
      <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      <div className="pl-20 flex-1 flex flex-col">
        {renderView()}
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }
  return user ? children : <Navigate to="/admin/login" replace />;
};

function AppContent() {
  const [setupCompleted, setSetupCompleted] = useState(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await axios.get(`${API}/setup/status`);
        setSetupCompleted(response.data.setup_completed);
      } catch (error) {
        setSetupCompleted(false);
      } finally {
        setCheckingSetup(false);
      }
    };
    checkSetupStatus();
  }, []);

  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (setupCompleted === false) {
    return <SetupWizard onComplete={() => setSetupCompleted(true)} />;
  }

  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/customer-login" element={<CustomerLoginPage />} />
          <Route path="/my-account" element={<MyAccountPage />} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route path="/portal" element={<PortalLayout />}>
            <Route index element={<PortalHome />} />
            <Route path="faq" element={<PortalFAQ />} />
            <Route path="support" element={<PortalSupport />} />
            <Route path="status" element={<PortalStatus />} />
          </Route>
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <ServiceProvider>
        <AppContent />
      </ServiceProvider>
    </AuthProvider>
  );
}

export default App;
