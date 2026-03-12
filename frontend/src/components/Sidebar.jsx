import React from 'react';
import { Home, Tv, Video, Radio, Bell, BookMarked, Settings, ChevronRight, Lock } from 'lucide-react';

const Sidebar = ({ activeView, onViewChange }) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'guide', label: 'Guide', icon: Tv },
    { id: 'ondemand', label: 'On Demand', icon: Video },
    { id: 'recordings', label: 'Recordings', icon: Radio },
    { id: 'notifications', label: 'What\'s New', icon: Bell },
    { id: 'saved', label: 'Saved', icon: BookMarked },
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
  ];

  const handleItemClick = (item) => {
    onViewChange(item.id);
  };

  return (
    <div className="fixed left-0 top-0 h-full w-20 bg-[#1a1a1a] border-r border-gray-800 flex flex-col items-center py-6 z-50">
      {/* Logo area */}
      <div className="w-12 h-12 bg-[#0056A8] rounded-xl flex items-center justify-center mb-8 shadow-lg flex-shrink-0">
        <Tv className="w-6 h-6 text-white" />
      </div>

      {/* Nav Items */}
      <nav className="flex-1 flex flex-col gap-1 w-full px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              data-testid={`sidebar-${item.id}`}
              className={`w-full flex flex-col items-center gap-1 py-3 px-1 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'bg-[#0056A8] text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-[#2a2a2a]'
              }`}
              title={item.label}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.adminOnly && (
                  <Lock className="w-2.5 h-2.5 absolute -top-1 -right-1 text-yellow-400" />
                )}
              </div>
              <span className="text-[9px] font-medium leading-tight text-center">
                {item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
