import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';

const TopBar = ({ onAddChannel }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="fixed top-0 left-24 right-0 h-20 bg-[#1a1a1a] border-b border-gray-800 flex items-center justify-between px-8 z-40">
      <div className="flex items-center gap-8">
        <h1 className="text-4xl font-light text-white">Guide</h1>
        <button
          onClick={onAddChannel}
          className="flex items-center gap-2 px-4 py-2 bg-[#0056A8] hover:bg-[#0066c8] text-white rounded-lg transition-colors duration-200"
        >
          <Plus className="w-5 h-5" />
          <span>Add Channel</span>
        </button>
      </div>
      <div className="flex items-center gap-8">
        <span className="text-2xl font-light text-white">{formatTime(currentTime)}</span>
        <div className="text-white text-4xl font-bold tracking-wider">TV Guide</div>
      </div>
    </div>
  );
};

export default TopBar;
