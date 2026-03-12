import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, Film, Tv, Star, Info } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const typeConfig = {
  movie: { label: 'Movie', icon: Film, color: 'bg-blue-700', border: 'border-blue-600' },
  tv_show: { label: 'TV Show', icon: Tv, color: 'bg-green-700', border: 'border-green-600' },
  mini_series: { label: 'Mini Series', icon: Star, color: 'bg-purple-700', border: 'border-purple-600' },
  limited_series: { label: 'Limited Series', icon: Star, color: 'bg-red-700', border: 'border-red-600' },
  system: { label: 'System', icon: Info, color: 'bg-gray-700', border: 'border-gray-600' },
};

const NotificationsPage = ({ onBack }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    const fetchNotifs = async () => {
      try {
        const res = await axios.get(`${API}/notifications`, { params: { active_only: true } });
        setNotifications(res.data);
      } catch (e) {
        console.error('Failed to load notifications', e);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifs();
  }, []);

  const filtered = filterType === 'all' ? notifications : notifications.filter(n => n.type === filterType);

  return (
    <div className="flex-1 overflow-y-auto bg-[#1a1a1a] text-white" data-testid="notifications-page">
      <div className="sticky top-0 z-10 bg-[#1a1a1a]/95 backdrop-blur px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-light flex items-center gap-3">
            <Bell className="w-7 h-7" /> Notifications
          </h1>
          <button onClick={onBack} className="text-gray-400 hover:text-white text-sm">← Back to Guide</button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {['all', ...Object.keys(typeConfig)].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-4 py-1.5 rounded-full text-sm transition-all whitespace-nowrap flex-shrink-0 ${filterType === t ? 'bg-[#0056A8] text-white' : 'bg-[#2a2a2a] text-gray-400 hover:text-white'}`}>
              {t === 'all' ? 'All' : typeConfig[t]?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#0056A8]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Bell className="w-20 h-20 mx-auto mb-4 opacity-30" />
            <p className="text-xl mb-2">No notifications</p>
            <p className="text-sm opacity-60">Check back soon for updates about new content</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((notif) => {
              const tc = typeConfig[notif.type] || typeConfig.system;
              const Icon = tc.icon;
              return (
                <div key={notif.id} className={`bg-[#2a2a2a] rounded-xl p-5 border-l-4 ${tc.border}`}
                  data-testid={`notif-card-${notif.id}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tc.color}`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-white font-semibold text-base">{notif.title}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs text-white ${tc.color}`}>{tc.label}</span>
                        {notif.channel_name && (
                          <span className="px-2 py-0.5 rounded text-xs text-gray-300 bg-gray-700">{notif.channel_name}</span>
                        )}
                      </div>
                      <p className="text-gray-300 text-sm leading-relaxed">{notif.message}</p>
                      <p className="text-gray-600 text-xs mt-2">{new Date(notif.created_at).toLocaleString()}</p>
                    </div>
                    {notif.image_path && (
                      <img src={`${BACKEND_URL}/api${notif.image_path}`} alt=""
                        className="w-20 h-20 object-cover rounded-lg flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
