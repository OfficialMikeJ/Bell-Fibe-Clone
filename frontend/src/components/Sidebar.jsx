import React from 'react';
import { Home, Grid3x3, PlaySquare, Film, Grid2x2, MapPin, Bookmark, Bell, Settings } from 'lucide-react';

const Sidebar = ({ activeView, setActiveView }) => {
  const menuItems = [
    { icon: Home, label: 'Home', view: 'home' },
    { icon: Grid3x3, label: 'Guide', view: 'guide' },
    { icon: PlaySquare, label: 'Recordings', view: 'recordings' },
    { icon: Film, label: 'On Demand', view: 'ondemand' },
    { icon: Grid2x2, label: 'Apps', view: 'apps' },
    { icon: MapPin, label: 'Explore', view: 'explore' },
    { icon: Bookmark, label: 'Saved', view: 'saved' },
    { icon: Bell, label: 'Notifications', view: 'notifications' },
    { icon: Settings, label: 'Settings', view: 'settings' }
  ];

  return (
    <div className="fixed left-0 top-0 h-screen w-24 bg-gradient-to-b from-[#0056A8] to-[#003d7a] flex flex-col items-center py-6 z-50">
      {/* Google Assistant style icon at top */}
      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-8 cursor-pointer hover:scale-110 transition-transform">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 via-red-500 to-yellow-500"></div>
      </div>

      {/* Menu items */}
      <div className="flex flex-col gap-6 flex-1">
        {menuItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeView === item.view;
          return (
            <button
              key={index}
              onClick={() => setActiveView(item.view)}
              className={`w-14 h-14 flex items-center justify-center rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-white/20 scale-110'
                  : 'hover:bg-white/10 hover:scale-105'
              }`}
              title={item.label}
            >
              <Icon className="w-7 h-7 text-white" strokeWidth={1.5} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;
