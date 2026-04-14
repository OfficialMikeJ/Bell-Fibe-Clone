import React, { useState } from 'react';
import axios from 'axios';
import { Home, Tv, Video, Radio, Bell, BookMarked, Settings, Lock, Signal, AlertTriangle, X, SlidersHorizontal, Info } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Sidebar = ({ activeView, onViewChange }) => {
  const [showSettingsWarning, setShowSettingsWarning] = useState(false);
  const [warningLogged, setWarningLogged] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'guide', label: 'TV Guide', icon: Tv },
    { id: 'ondemand', label: 'On-Demand', icon: Video },
    { id: 'recordings', label: 'Recordings', icon: Radio },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'saved', label: 'Saved', icon: BookMarked },
    { id: 'user-settings', label: 'Settings', icon: SlidersHorizontal },
    { id: 'app-info', label: 'Version', icon: Info },
    { id: 'settings', label: 'Admin', icon: Settings, adminOnly: true },
    { id: 'tuner', label: 'Live TV', icon: Signal, comingSoon: true },
  ];

  const handleItemClick = (item) => {
    if (item.comingSoon) return; // Do nothing for coming soon items
    if (item.adminOnly) {
      // Log attempt and show warning
      logAccessAttempt();
      setShowSettingsWarning(true);
      return;
    }
    onViewChange(item.id);
  };

  const logAccessAttempt = async () => {
    if (warningLogged) return; // Don't spam logs
    try {
      await axios.post(`${API}/security/log-access-attempt`, null, {
        params: {
          attempt_type: 'unauthorized_settings_access',
          message: 'User attempted to access admin Settings from TV guide sidebar'
        }
      });
      setWarningLogged(true);
      setTimeout(() => setWarningLogged(false), 30000); // Reset after 30s
    } catch (e) {
      // Silent fail - logging is best-effort
    }
  };

  const handleGoToAdmin = () => {
    setShowSettingsWarning(false);
    onViewChange('settings');
  };

  return (
    <>
      <div className="fixed left-0 top-0 h-full w-24 bg-[#1a1a1a] border-r border-gray-800 flex flex-col items-center py-6 z-50">
        {/* Logo */}
        <div className="w-12 h-12 bg-[#0056A8] rounded-xl flex items-center justify-center mb-8 shadow-lg flex-shrink-0">
          <Tv className="w-6 h-6 text-white" />
        </div>

        {/* Nav Items */}
        <nav className="flex-1 flex flex-col gap-1 w-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id && !item.adminOnly && !item.comingSoon;
            const isComingSoon = item.comingSoon;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                data-testid={`sidebar-${item.id}`}
                disabled={isComingSoon}
                title={isComingSoon ? `${item.label} — Coming Soon` : item.label}
                className={`w-full flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-all duration-200 relative ${
                  isComingSoon
                    ? 'opacity-30 cursor-not-allowed text-gray-600'
                    : isActive
                    ? 'bg-[#0056A8] text-white shadow-lg'
                    : item.adminOnly
                    ? 'text-yellow-500 hover:bg-yellow-900/20'
                    : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.adminOnly && (
                    <Lock className="w-2.5 h-2.5 absolute -top-1 -right-1 text-yellow-400" />
                  )}
                </div>
                <span className="text-[10px] font-medium leading-tight text-center">{item.label}</span>
                {isComingSoon && (
                  <span className="absolute top-0.5 right-0.5 text-[6px] text-gray-500 font-bold">SOON</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings Access Warning Dialog */}
      {showSettingsWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1a1a1a] border border-yellow-600/50 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-yellow-600/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-7 h-7 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-white text-xl font-bold">Access Restricted</h2>
                <p className="text-yellow-400 text-sm">Admin authentication required</p>
              </div>
              <button onClick={() => setShowSettingsWarning(false)}
                className="ml-auto text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-300 text-sm mb-3 leading-relaxed">
              This area is restricted to authorized administrators only.
            </p>
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-3 mb-6">
              <p className="text-yellow-300 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                Your access attempt has been logged and the administrator has been notified.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSettingsWarning(false)}
                className="flex-1 py-2.5 rounded-xl bg-[#2a2a2a] text-gray-300 hover:bg-[#3a3a3a] text-sm font-medium transition-colors">
                Go Back
              </button>
              <button onClick={handleGoToAdmin}
                data-testid="settings-admin-login-btn"
                className="flex-1 py-2.5 rounded-xl bg-[#0056A8] text-white hover:bg-[#0066c8] text-sm font-medium transition-colors">
                Admin Login
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
