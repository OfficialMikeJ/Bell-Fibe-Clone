import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../config';

const s = {
  page: { minHeight: '100vh', background: '#0a0a0a', padding: '24px 32px' },
  header: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 },
  back: { background: '#222', border: '1px solid #333', color: '#fff', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14 },
  title: { fontSize: 24, fontWeight: 700, color: '#fff' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 },
  card: { background: '#161616', border: '1px solid #222', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s' },
  poster: { width: '100%', paddingTop: '56%', background: '#222', position: 'relative' },
  posterImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
  posterPlaceholder: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 },
  cardBody: { padding: '12px 14px' },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 },
  cardMeta: { fontSize: 12, color: '#777' },
  empty: { textAlign: 'center', color: '#555', padding: 64 },
};

const BACKEND_URL = API_URL;

export default function VODPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API_URL}/api/vod`).then(res => setItems(res.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.back} onClick={() => navigate('/')}>← Back</button>
        <h1 style={s.title}>On Demand</h1>
      </div>
      {loading ? (
        <div style={s.empty}>Loading content...</div>
      ) : items.length === 0 ? (
        <div style={s.empty}>No on-demand content available yet.</div>
      ) : (
        <div style={s.grid}>
          {items.map(item => (
            <div key={item.id} style={s.card} tabIndex={0}
              onFocus={e => { e.currentTarget.style.borderColor = '#0056A8'; e.currentTarget.style.transform = 'scale(1.02)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={s.poster}>
                {item.poster_path ? (
                  <img style={s.posterImg} src={`${BACKEND_URL}/api${item.poster_path}`} alt={item.title} />
                ) : (
                  <div style={s.posterPlaceholder}>🎬</div>
                )}
              </div>
              <div style={s.cardBody}>
                <div style={s.cardTitle}>{item.title || item.channel_name}</div>
                <div style={s.cardMeta}>{item.genre || 'Video'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
