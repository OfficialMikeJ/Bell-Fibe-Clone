import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Sidebar from '../components/Sidebar';
import GuideTopBar from '../components/GuideTopBar';
import ChannelFeatured from '../components/ChannelFeatured';
import EPGGrid from '../components/EPGGrid';
import VODPage from './VODPage';
import RecordingsPage from './RecordingsPage';

const API_URL = process.env.REACT_APP_API_URL;

// ── Time slot generator ──────────────────────────────────────────────────────
function generateTimeSlots() {
  const slots = [];
  const now = new Date();
  const base = new Date(now);
  base.setMinutes(base.getMinutes() < 30 ? 0 : 30, 0, 0);
  for (let i = 0; i < 18; i++) {
    const t = new Date(base.getTime() + i * 30 * 60000);
    slots.push(t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }));
  }
  return slots;
}

// ── Placeholder views ────────────────────────────────────────────────────────
function HomeView({ onViewChange }) {
  return (
    <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 bg-[#0056A8] rounded-2xl flex items-center justify-center mx-auto mb-6">
          <span className="text-white text-3xl">📺</span>
        </div>
        <h1 className="text-white text-4xl font-bold mb-4">StreamVault TV</h1>
        <p className="text-gray-400 text-lg mb-8">Your premium TV experience</p>
        <button
          onClick={() => onViewChange('guide')}
          className="px-8 py-3 bg-[#0056A8] text-white rounded-xl text-lg font-semibold hover:bg-[#0066c8] transition-colors"
          data-testid="home-go-to-guide-btn"
        >
          Open TV Guide
        </button>
      </div>
    </div>
  );
}

function NotificationsView({ onViewChange }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/notifications`)
      .then(res => setNotifications(res.data.filter(n => n.is_active)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex-1 bg-[#1a1a1a] overflow-y-auto">
      <GuideTopBar />
      <div className="pt-16 pl-8 pr-6 py-6">
        <h2 className="text-white text-3xl font-light mb-6">What's New</h2>
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : notifications.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-xl">No announcements right now</p>
            <button onClick={() => onViewChange('guide')} className="mt-4 text-[#0056A8] hover:underline text-sm">
              ← Back to Guide
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            {notifications.map(n => (
              <div key={n.id} className="bg-[#2a2a2a] rounded-xl p-5 border border-gray-700">
                <h3 className="text-white font-semibold text-lg mb-1">{n.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed">{n.message}</p>
                {n.created_at && (
                  <p className="text-gray-500 text-xs mt-2">
                    {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SavedView({ onViewChange }) {
  return (
    <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center">
      <div className="text-center">
        <p className="text-white text-2xl mb-2">Saved</p>
        <p className="text-gray-400 text-sm">Your saved programs will appear here</p>
        <button onClick={() => onViewChange('guide')} className="mt-6 text-[#0056A8] hover:underline text-sm">
          ← Back to Guide
        </button>
      </div>
    </div>
  );
}

// ── Main EPG / Guide view ────────────────────────────────────────────────────
function GuideView() {
  const [channels, setChannels] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const timeSlots = generateTimeSlots();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [chRes, pgRes] = await Promise.all([
          axios.get(`${API_URL}/api/channels`),
          axios.get(`${API_URL}/api/programs`),
        ]);
        const chs = Array.isArray(chRes.data) ? chRes.data : chRes.data.channels || [];
        setChannels(chs);
        if (chs.length > 0) setSelectedChannel(chs[0]);
        setPrograms(Array.isArray(pgRes.data) ? pgRes.data : pgRes.data.programs || []);
      } catch (e) {
        console.error('Failed to load guide data', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getCurrentProgram = useCallback(() => {
    if (!selectedChannel) return null;
    return programs.find(p => p.channel_id === selectedChannel.id) || null;
  }, [selectedChannel, programs]);

  if (loading) {
    return (
      <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-white text-2xl">Loading guide...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-[#1a1a1a] overflow-y-auto">
      <GuideTopBar />
      <div className="pt-16 pl-8 pr-6 py-6">
        {selectedChannel && (
          <ChannelFeatured channel={selectedChannel} currentProgram={getCurrentProgram()} />
        )}
        {channels.length > 0 ? (
          <div className="sv-fade-in" style={{ animationDelay: '200ms' }}>
            <EPGGrid
              channels={channels}
              programs={programs}
              timeSlots={timeSlots.slice(0, 14)}
              selectedChannelId={selectedChannel?.id}
              onChannelSelect={setSelectedChannel}
            />
          </div>
        ) : (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-xl">No channels available</p>
            <p className="text-sm mt-2">Contact your administrator to add channels</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root: TVGuide shell with Sidebar + view switching ────────────────────────
export default function TVGuide({ deviceInfo }) {
  const [activeView, setActiveView] = useState('guide');

  const handleLogout = () => {
    localStorage.removeItem('sv_device');
    window.location.reload();
  };

  const handleViewChange = (viewId) => setActiveView(viewId);

  const renderView = () => {
    switch (activeView) {
      case 'home':
        return <HomeView onViewChange={handleViewChange} />;
      case 'guide':
        return <GuideView />;
      case 'vod':
        return <VODPage onBack={() => setActiveView('guide')} />;
      case 'recordings':
        return <RecordingsPage deviceInfo={deviceInfo} onBack={() => setActiveView('guide')} />;
      case 'notifications':
        return <NotificationsView onViewChange={handleViewChange} />;
      case 'saved':
        return <SavedView onViewChange={handleViewChange} />;
      default:
        return <GuideView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#1a1a1a]">
      <Sidebar activeView={activeView} onViewChange={handleViewChange} />
      <div className="pl-20 flex-1 flex flex-col">
        <div key={activeView} className="sv-view-fade flex-1 flex flex-col">
          {renderView()}
        </div>
      </div>
    </div>
  );
}
