import React, { useState, useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import ChannelFeatured from "./components/ChannelFeatured";
import EPGGrid from "./components/EPGGrid";
import LoginPage from "./components/LoginPage";
import AdminDashboard from "./components/AdminDashboard";
import { Toaster } from "./components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Generate time slots for 24 hours with 30-minute intervals
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let min = 0; min < 60; min += 30) {
      const period = hour >= 12 ? 'p.m.' : 'a.m.';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const time = `${displayHour}:${min.toString().padStart(2, '0')} ${period}`;
      slots.push(time);
    }
  }
  return slots;
};

const timeSlots = generateTimeSlots();

const GuideView = () => {
  const [channels, setChannels] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChannels();
    fetchPrograms();
  }, []);

  const fetchChannels = async () => {
    try {
      const response = await axios.get(`${API}/channels`);
      setChannels(response.data);
      if (response.data.length > 0 && !selectedChannel) {
        setSelectedChannel(response.data[0]);
      }
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const response = await axios.get(`${API}/programs`);
      setPrograms(response.data);
    } catch (error) {
      console.error('Error fetching programs:', error);
    }
  };

  const handleChannelSelect = (channel) => {
    setSelectedChannel(channel);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-white text-2xl">Loading guide...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      <TopBar />
      
      <div className="pt-16 pl-20 px-6 py-6">
        {selectedChannel && <ChannelFeatured channel={selectedChannel} />}
        {channels.length > 0 ? (
          <EPGGrid
            channels={channels}
            programs={programs}
            timeSlots={timeSlots.slice(0, 14)} // Show 7 hours worth of slots
            selectedChannelId={selectedChannel?.id}
            onChannelSelect={handleChannelSelect}
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

  return (
    <div className="relative">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      {activeView === 'guide' ? (
        <GuideView />
      ) : activeView === 'settings' ? (
        <Navigate to="/admin" replace />
      ) : activeView === 'home' ? (
        <div className="pl-20 pt-16 min-h-screen bg-[#1a1a1a] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-white text-4xl font-bold mb-4">Welcome to IPTV Service</h1>
            <p className="text-gray-400 text-lg">Select Guide to view TV channels</p>
          </div>
        </div>
      ) : (
        <div className="pl-20 pt-16 min-h-screen bg-[#1a1a1a] flex items-center justify-center">
          <div className="text-center">
            <p className="text-white text-2xl">
              {activeView.charAt(0).toUpperCase() + activeView.slice(1)} - Coming Soon
            </p>
            <p className="text-gray-400 text-sm mt-2">This feature will be available in future updates</p>
          </div>
        </div>
      )}
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
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
