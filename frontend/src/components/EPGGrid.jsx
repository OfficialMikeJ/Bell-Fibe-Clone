import React from 'react';
import { Info } from 'lucide-react';

const EPGGrid = ({ channels, programs, timeSlots, selectedChannelId, onChannelSelect }) => {
  const getTimeInMinutes = (timeStr) => {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'p.m.' && hours !== 12) hours += 12;
    if (period === 'a.m.' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const calculateProgramWidth = (duration) => {
    return (duration / 30) * 200; // 200px per 30 minutes
  };

  return (
    <div className="overflow-x-auto">
      {/* Time Header */}
      <div className="flex mb-4">
        <div className="w-64 flex-shrink-0 px-4 py-3">
          <span className="text-xl text-gray-400 font-light">Today</span>
        </div>
        <div className="flex gap-0">
          {timeSlots.map((time, index) => (
            <div key={index} className="w-[200px] px-4 py-3 flex-shrink-0">
              <span className="text-xl text-gray-300 font-light">{time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Channel Rows */}
      <div className="space-y-2">
        {channels.map((channel) => {
          const isSelected = channel.id === selectedChannelId;
          const channelPrograms = programs[channel.id] || [];

          return (
            <div
              key={channel.id}
              className={`flex cursor-pointer transition-all duration-200 ${
                isSelected ? 'scale-[1.02]' : ''
              }`}
              onClick={() => onChannelSelect(channel)}
            >
              {/* Channel Info */}
              <div
                className={`w-64 flex-shrink-0 flex items-center gap-3 px-4 py-3 bg-[#2a2a2a] rounded-l-lg ${
                  isSelected ? 'border-4 border-white' : 'border-4 border-transparent'
                }`}
              >
                <div className="w-16 h-16 bg-[#3a3a3a] rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={channel.logo}
                    alt={channel.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-lg truncate">{channel.name}</p>
                  <p className="text-gray-400 text-sm">{channel.number}</p>
                </div>
              </div>

              {/* Program Schedule */}
              <div className="flex-1 flex items-center bg-[#2a2a2a] rounded-r-lg overflow-hidden relative">
                <div className="flex gap-0 h-full">
                  {channelPrograms.map((program, idx) => {
                    const width = calculateProgramWidth(program.duration);
                    return (
                      <div
                        key={idx}
                        className="flex items-center px-4 py-3 bg-[#3a3a3a] border-r border-[#2a2a2a] hover:bg-[#4a4a4a] transition-colors group relative"
                        style={{ width: `${width}px`, minWidth: `${width}px` }}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-white text-base truncate">{program.title}</span>
                          <Info className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom instruction */}
      <div className="mt-8 text-center">
        <p className="text-gray-400 text-lg">Press the Back button to go to the menu</p>
      </div>
    </div>
  );
};

export default EPGGrid;
