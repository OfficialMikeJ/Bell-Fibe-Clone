import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL, GUIDE_TITLE } from '../config';

const NAV_ITEMS = [
  { id: 'guide', label: 'Guide', emoji: '📺' },
  { id: 'vod', label: 'On Demand', emoji: '🎬' },
  { id: 'recordings', label: 'Recordings', emoji: '⏺' },
  { id: 'notifications', label: "What's New", emoji: '🔔' },
];

const s = {
  app: { display: 'flex', height: '100vh', background: '#0a0a0a', overflow: 'hidden' },
  sidebar: {
    width: 220, background: '#111', borderRight: '1px solid #222',
    display: 'flex', flexDirection: 'column', padding: '20px 0', flexShrink: 0,
  },
  sidebarLogo: { padding: '0 20px 24px', borderBottom: '1px solid #222', marginBottom: 12 },
  sidebarLogoTitle: { fontSize: 18, fontWeight: 700, color: '#fff' },
  sidebarLogoSub: { fontSize: 12, color: '#0056A8', marginTop: 2 },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px',
    fontSize: 16, fontWeight: 500, color: '#999', background: 'none', border: 'none',
    width: '100%', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
    borderLeft: '3px solid transparent',
  },
  navItemActive: {
    color: '#fff', background: 'rgba(0,86,168,0.15)',
    borderLeftColor: '#0056A8',
  },
  content: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  hero: {
    background: 'linear-gradient(to right, #111 0%, transparent 60%), #1a1a1a',
    padding: '32px 32px 24px', borderBottom: '1px solid #222',
  },
  heroNow: { fontSize: 12, color: '#0056A8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  heroTitle: { fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 6 },
  heroMeta: { fontSize: 14, color: '#999', marginBottom: 16 },
  heroBadge: {
    display: 'inline-block', background: '#0056A8', color: '#fff',
    fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6,
  },
  section: { padding: '24px 32px' },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  channelList: { display: 'flex', flexDirection: 'column', gap: 2 },
  channelRow: {
    display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px',
    background: '#111', borderRadius: 10, border: '1px solid #222',
    cursor: 'pointer', transition: 'all 0.15s',
  },
  channelNum: { fontSize: 13, color: '#666', width: 30, textAlign: 'right', flexShrink: 0 },
  channelName: { flex: 1, fontSize: 16, color: '#ddd', fontWeight: 500 },
  channelProgram: { fontSize: 13, color: '#666', flexShrink: 0, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  time: { fontSize: 12, color: '#0056A8', flexShrink: 0 },
  empty: { textAlign: 'center', color: '#555', padding: 48 },
  loading: { textAlign: 'center', color: '#555', padding: 48 },
};

export default function TVGuide({ deviceInfo }) {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('guide');
  const [channels, setChannels] = useState([]);
  const [programs, setPrograms] = useState({});
  const [loading, setLoading] = useState(true);
  const [time, setTime] = useState(new Date());

  // Update clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [chRes] = await Promise.all([
        axios.get(`${API_URL}/api/channels?channel_type=live`),
      ]);
      setChannels(chRes.data || []);
      // Fetch current programs for each channel
      const now = new Date().toISOString();
      const progMap = {};
      for (const ch of (chRes.data || []).slice(0, 20)) {
        try {
          const pRes = await axios.get(`${API_URL}/api/programs/channel/${ch.id}`);
          const nowProg = (pRes.data || []).find(p => {
            const start = new Date(p.start_time);
            const end = new Date(p.end_time);
            return start <= new Date() && end >= new Date();
          });
          if (nowProg) progMap[ch.id] = nowProg;
        } catch {}
      }
      setPrograms(progMap);
    } catch (e) {
      console.error('Failed to load guide data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleNav = (id) => {
    setActiveNav(id);
    if (id === 'vod') navigate('/vod');
    if (id === 'recordings') navigate('/recordings');
  };

  const formatTime = (t) => {
    const d = new Date(t);
    return d.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const currentTime = time.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
  const currentDate = time.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });

  const featuredChannel = channels[0];
  const featuredProgram = featuredChannel ? programs[featuredChannel.id] : null;

  return (
    <div style={s.app}>
      {/* Sidebar */}
      <div style={s.sidebar}>
        <div style={s.sidebarLogo}>
          <div style={s.sidebarLogoTitle}>{GUIDE_TITLE}</div>
          <div style={s.sidebarLogoSub}>{currentTime} · {currentDate.split(',')[0]}</div>
        </div>
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => handleNav(item.id)}
            style={{ ...s.navItem, ...(activeNav === item.id ? s.navItemActive : {}) }}
          >
            <span style={{ fontSize: 18 }}>{item.emoji}</span>
            {item.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {deviceInfo && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid #222' }}>
            <div style={{ fontSize: 11, color: '#555' }}>Signed in as</div>
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{deviceInfo.customer_name || deviceInfo.user_id}</div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div style={s.content}>
        {/* Featured now playing */}
        {featuredChannel && (
          <div style={s.hero}>
            <div style={s.heroNow}>Now Playing</div>
            <div style={s.heroTitle}>{featuredProgram?.title || featuredChannel.name}</div>
            <div style={s.heroMeta}>
              {featuredChannel.name}
              {featuredProgram && ` · ${formatTime(featuredProgram.start_time)} – ${formatTime(featuredProgram.end_time)}`}
            </div>
            <span style={s.heroBadge}>
              {featuredChannel.quality_label || 'HD'}
            </span>
          </div>
        )}

        {/* Channel list */}
        <div style={s.section}>
          <div style={s.sectionTitle}>
            {loading ? 'Loading channels...' : `${channels.length} Live Channels`}
          </div>
          {loading ? (
            <div style={s.loading}>Loading your channel lineup...</div>
          ) : channels.length === 0 ? (
            <div style={s.empty}>No live channels configured yet.</div>
          ) : (
            <div style={s.channelList}>
              {channels.map((ch, idx) => {
                const prog = programs[ch.id];
                return (
                  <div
                    key={ch.id}
                    tabIndex={0}
                    style={s.channelRow}
                    onFocus={e => { e.currentTarget.style.background = '#1a2a3a'; e.currentTarget.style.borderColor = '#0056A8'; }}
                    onBlur={e => { e.currentTarget.style.background = '#111'; e.currentTarget.style.borderColor = '#222'; }}
                  >
                    <span style={s.channelNum}>{idx + 1}</span>
                    <span style={s.channelName}>{ch.name}</span>
                    {prog ? (
                      <>
                        <span style={s.channelProgram}>{prog.title}</span>
                        <span style={s.time}>{formatTime(prog.start_time)}</span>
                      </>
                    ) : (
                      <span style={s.channelProgram}>No program info</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
