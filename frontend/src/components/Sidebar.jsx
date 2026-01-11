import React from 'react';
import { Home, Grid3x3, PlaySquare, Film, Grid2x2, MapPin, Bookmark, Bell, Settings } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

const Sidebar = ({ activeView, setActiveView }) => {
  const menuItems = [
    { icon: Home, label: 'Home', view: 'home', enabled: true },
    { icon: Grid3x3, label: 'Guide', view: 'guide', enabled: true },
    { icon: PlaySquare, label: 'Recordings (CVR)', view: 'recordings', enabled: false },
    { icon: Film, label: 'On Demand', view: 'ondemand', enabled: false },
    { icon: Grid2x2, label: 'Apps', view: 'apps', enabled: false },
    { icon: MapPin, label: 'Explore', view: 'explore', enabled: false },
    { icon: Bookmark, label: 'Saved', view: 'saved', enabled: false },
    { icon: Bell, label: 'Notifications', view: 'notifications', enabled: false },
    { icon: Settings, label: 'Settings', view: 'settings', enabled: true }
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-20 bg-gradient-to-b from-[#0056A8] to-[#003d7a] flex flex-col items-center py-4 z-50">
      {/* Google Assistant style icon at top */}
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-6 cursor-pointer hover:scale-110 transition-transform">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500"></div>
      </div>

      {/* Menu items */}
      <TooltipProvider>
        <div className="flex flex-col gap-4 flex-1">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeView === item.view;
            const isDisabled = !item.enabled;
            
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => item.enabled && setActiveView(item.view)}
                    disabled={isDisabled}
                    className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all duration-200 ${
                      isDisabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isActive
                        ? 'bg-white/20 scale-110'
                        : 'hover:bg-white/10 hover:scale-105'
                    }`}
                    title={item.label}
                  >
                    <Icon className="w-6 h-6 text-white" strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-gray-900 text-white border-gray-700">
                  <p>{item.label}</p>
                  {isDisabled && <p className="text-xs text-gray-400 mt-1">Coming Soon</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
};

export default Sidebar;
