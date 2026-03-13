import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { GUIDE_TITLE } from '../config';

const GuideTopBar = ({ onLogout }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) =>
    date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  return (
    <div className="sv-slide-down fixed top-0 left-20 right-0 h-16 bg-[#1a1a1a] border-b border-gray-800 flex items-center justify-between px-6 z-40">
      <div className="flex items-center gap-6">
        <h1 className="text-3xl font-light text-white">Guide</h1>
      </div>
      <div className="flex items-center gap-6">
        <span className="text-xl font-light text-white">{formatTime(currentTime)}</span>
        <div className="text-white text-2xl font-bold tracking-wider" data-testid="guide-service-name">
          {GUIDE_TITLE}
        </div>
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-600 text-white text-sm hover:bg-gray-800 transition-colors"
            data-testid="guide-logout-btn"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        )}
      </div>
    </div>
  );
};

export default GuideTopBar;
