import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';

const s = {
  page: { minHeight: '100vh', background: '#0a0a0a', padding: '24px 32px' },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  back: { background: '#222', border: '1px solid #333', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
  title: { fontSize: 24, fontWeight: 700, color: '#fff' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  item: { background: '#161616', border: '1px solid #222', borderRadius: 10, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 },
  icon: { fontSize: 24, flexShrink: 0 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 },
  meta: { fontSize: 13, color: '#777' },
  badge: { fontSize: 12, padding: '4px 10px', borderRadius: 6, flexShrink: 0 },
  empty: { textAlign: 'center', color: '#555', padding: 64 },
};

const STATUS_COLORS = {
  scheduled: { background: '#1a2a3a', color: '#60aff0' },
  completed: { background: '#152515', color: '#4ade80' },
  failed: { background: '#2a1515', color: '#f87171' },
};

export default function RecordingsPage({ deviceInfo }) {
  const navigate = useNavigate();
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceInfo?.user_id) return;
    axios.get(`${API_URL}/api/recordings/user/${deviceInfo.user_id}`)
      .then(res => setRecordings(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [deviceInfo]);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate('/')}>← Back</button>
        <h1 style={s.title}>My Recordings</h1>
      </div>
      {loading ? (
        <div style={s.empty}>Loading recordings...</div>
      ) : recordings.length === 0 ? (
        <div style={s.empty}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏺</div>
          No recordings yet. Record programs from the TV Guide.
        </div>
      ) : (
        <div style={s.list}>
          {recordings.map(rec => (
            <div key={rec.id} style={s.item} tabIndex={0}
              onFocus={e => { e.currentTarget.style.borderColor = '#0056A8'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#222'; }}
            >
              <span style={s.icon}>📹</span>
              <div style={s.info}>
                <div style={s.name}>{rec.program_title || 'Untitled Recording'}</div>
                <div style={s.meta}>
                  {new Date(rec.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{ ...s.badge, ...(STATUS_COLORS[rec.status] || STATUS_COLORS.scheduled) }}>
                {rec.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
