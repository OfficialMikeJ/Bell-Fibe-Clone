import React from 'react';
import { Info } from 'lucide-react';

const EPGGrid = ({ channels, programs, timeSlots, selectedChannelId, onChannelSelect }) => {
  const calculateProgramWidth = (duration) => {
    return (duration / 30) * 160; // 160px per 30 minutes (reduced from 200px)
  };

  const getProgramsForChannel = (channelId) => {
    return programs.filter(p => p.channel_id === channelId).sort((a, b) => {
      return a.start_time.localeCompare(b.start_time);
    });
  };

  return (
    <div className="overflow-x-auto">
      {/* Time Header */}
      <div className="flex mb-3">
        <div className="w-52 flex-shrink-0 px-3 py-2">
          <span className="text-lg text-gray-400 font-light">Today</span>
        </div>
        <div className="flex gap-0">
          {timeSlots.map((time, index) => (
            <div key={index} className="w-[160px] px-3 py-2 flex-shrink-0">
              <span className="text-lg text-gray-300 font-light">{time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Channel Rows */}
      <div className="space-y-1.5">
        {channels.map((channel) => {
          const isSelected = channel.id === selectedChannelId;
          const channelPrograms = getProgramsForChannel(channel.id);

          return (
            <div
              key={channel.id}
              className={`flex cursor-pointer transition-all duration-200 ${
                isSelected ? 'scale-[1.01]' : ''
              }`}
              onClick={() => onChannelSelect(channel)}
            >
              {/* Channel Info */}
              <div
                className={`w-52 flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] rounded-l-lg ${
                  isSelected ? 'border-3 border-white' : 'border-3 border-transparent'
                }`}
              >
                <div className="w-12 h-12 bg-[#3a3a3a] rounded-md overflow-hidden flex-shrink-0">
                  <img
                    src={channel.logo_path || channel.logo}
                    alt={channel.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-base truncate">{channel.name}</p>
                  <p className="text-gray-400 text-xs">{channel.number}</p>
                </div>
              </div>

              {/* Program Schedule */}
              <div className="flex-1 flex items-center bg-[#2a2a2a] rounded-r-lg overflow-hidden relative">
                <div className="flex gap-0 h-full">
                  {channelPrograms.length > 0 ? (
                    channelPrograms.map((program, idx) => {
                      const width = calculateProgramWidth(program.duration_minutes);
                      return (
                        <div
                          key={idx}
                          className="flex items-center px-3 py-2 bg-[#3a3a3a] border-r border-[#2a2a2a] hover:bg-[#4a4a4a] transition-colors group relative"
                          style={{ width: `${width}px`, minWidth: `${width}px` }}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-white text-sm truncate">{program.title}</span>
                            <Info className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-gray-500 text-sm">No programs scheduled</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom instruction */}
      <div className="mt-6 text-center">
        <p className="text-gray-400 text-base">Press the Back button to go to the menu</p>
      </div>
    </div>
  );
};

export default EPGGrid;
