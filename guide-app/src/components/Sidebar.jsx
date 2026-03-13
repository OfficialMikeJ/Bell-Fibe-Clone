import React, { useState } from 'react';
import axios from 'axios';
import { Home, Tv, Video, Radio, Bell, BookMarked, AlertTriangle, X, Signal } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL;

const Sidebar = ({ activeView, onViewChange }) => {
  const [showWarning, setShowWarning] = useState(false);
  const [warningLogged, setWarningLogged] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'guide', label: 'Guide', icon: Tv },
    { id: 'vod', label: 'On Demand', icon: Video },
    { id: 'recordings', label: 'Recordings', icon: Radio },
    { id: 'notifications', label: "What's New", icon: Bell },
    { id: 'saved', label: 'Saved', icon: BookMarked },
    { id: 'tuner', label: 'Live TV', icon: Signal, comingSoon: true },
  ];

  const logAccessAttempt = async () => {
    if (warningLogged) return;
    try {
      await axios.post(`${API_URL}/api/security/log-access-attempt`, null, {
        params: { attempt_type: 'unauthorized_settings_access', message: 'User attempted to access admin Settings from TV guide' }
      });
      setWarningLogged(true);
      setTimeout(() => setWarningLogged(false), 30000);
    } catch (e) { /* silent */ }
  };

  const handleItemClick = (item) => {
    if (item.comingSoon) return;
    onViewChange(item.id);
  };

  return (
    <>
      <div className="fixed left-0 top-0 h-full w-20 bg-[#1a1a1a] border-r border-gray-800 flex flex-col items-center py-6 z-50">
        {/* Logo */}
        <div className="sv-slide-down w-12 h-12 bg-[#0056A8] rounded-xl flex items-center justify-center mb-8 shadow-lg flex-shrink-0">
          <Tv className="w-6 h-6 text-white" />
        </div>

        {/* Nav items */}
        <nav className="flex-1 flex flex-col gap-1 w-full px-2">
          {navItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeView === item.id && !item.comingSoon;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                data-testid={`guide-sidebar-${item.id}`}
                disabled={item.comingSoon}
                title={item.comingSoon ? `${item.label} — Coming Soon` : item.label}
                className={`sv-slide-right w-full flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-all duration-200 relative ${
                  item.comingSoon
                    ? 'opacity-30 cursor-not-allowed text-gray-600'
                    : isActive
                    ? 'bg-[#0056A8] text-white shadow-lg'
                    : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'
                }`}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] font-medium leading-tight text-center">{item.label.split(' ')[0]}</span>
                {item.comingSoon && (
                  <span className="absolute top-0.5 right-0.5 text-[6px] text-gray-500 font-bold">SOON</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
