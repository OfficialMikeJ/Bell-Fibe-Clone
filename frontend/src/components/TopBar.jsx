import React, { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { useService } from '../contexts/ServiceContext';

const TopBar = ({ onLogout }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { serviceName } = useService();

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
    <div className="fixed top-0 left-20 right-0 h-16 bg-[#1a1a1a] border-b border-gray-800 flex items-center justify-between px-6 z-40">
      <div className="flex items-center gap-6">
        <h1 className="text-3xl font-light text-white">Guide</h1>
      </div>
      <div className="flex items-center gap-6">
        <span className="text-xl font-light text-white">{formatTime(currentTime)}</span>
        <div className="text-white text-3xl font-bold tracking-wider" data-testid="service-name-display">
          {serviceName}
        </div>
        {onLogout && (
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="bg-transparent border-gray-600 text-white hover:bg-gray-800"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        )}
      </div>
    </div>
  );
};

export default TopBar;
