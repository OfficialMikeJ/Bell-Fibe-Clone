import React, { useEffect, useRef, useState } from 'react';
import { Info, Circle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const EPGGrid = ({ channels, programs, timeSlots, selectedChannelId, onChannelSelect }) => {
  const [focusedChannelIdx, setFocusedChannelIdx] = useState(0);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const containerRef = useRef(null);

  const calculateProgramWidth = (duration) => {
    return (duration / 30) * 160;
  };

  const getProgramsForChannel = (channelId) => {
    return programs.filter(p => p.channel_id === channelId).sort((a, b) =>
      a.start_time.localeCompare(b.start_time)
    );
  };

  // Keyboard / Android remote navigation (D-pad)
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedChannelIdx(prev => {
            const next = Math.min(prev + 1, channels.length - 1);
            onChannelSelect(channels[next]);
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedChannelIdx(prev => {
            const next = Math.max(prev - 1, 0);
            onChannelSelect(channels[next]);
            return next;
          });
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (channels[focusedChannelIdx]) {
            onChannelSelect(channels[focusedChannelIdx]);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels, focusedChannelIdx, onChannelSelect]);

  // Sync focus idx with selected channel
  useEffect(() => {
    const idx = channels.findIndex(c => c.id === selectedChannelId);
    if (idx >= 0) setFocusedChannelIdx(idx);
  }, [selectedChannelId, channels]);

  const getLogoSrc = (channel) => {
    if (!channel.logo_path) return null;
    if (channel.logo_path.startsWith('http')) return channel.logo_path;
    return `${BACKEND_URL}${channel.logo_path}`;
  };

  const getLogoFallback = (channel, e) => {
    e.target.style.display = 'none';
    e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
  };

  return (
    <div className="overflow-x-auto" ref={containerRef} tabIndex={-1}>
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
        {channels.map((channel, idx) => {
          const isSelected = channel.id === selectedChannelId;
          const isFocused = idx === focusedChannelIdx;
          const channelPrograms = getProgramsForChannel(channel.id);
          const logoSrc = getLogoSrc(channel);

          return (
            <div
              key={channel.id}
              data-testid={`epg-channel-row-${channel.id}`}
              className={`flex cursor-pointer transition-all duration-200 ${isSelected ? 'scale-[1.01]' : ''}`}
              onClick={() => { onChannelSelect(channel); setFocusedChannelIdx(idx); }}
            >
              {/* Channel Info */}
              <div
                className={`w-52 flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-[#2a2a2a] rounded-l-lg ${
                  isSelected ? 'border-2 border-white' : isFocused ? 'border-2 border-[#0056A8]' : 'border-2 border-transparent'
                }`}
              >
                <div className="w-12 h-12 bg-[#3a3a3a] rounded-md overflow-hidden flex-shrink-0 relative">
                  {logoSrc ? (
                    <>
                      <img
                        src={logoSrc}
                        alt={channel.name}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => getLogoFallback(channel, e)}
                      />
                      <div className="w-full h-full items-center justify-center bg-[#0056A8] absolute inset-0 hidden">
                        <span className="text-white text-sm font-bold">{channel.number}</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0056A8] to-[#003d7a]">
                      <span className="text-white text-sm font-bold">{channel.number}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-base truncate">{channel.name}</p>
                  <p className="text-gray-400 text-xs flex items-center gap-1">
                    {channel.number}
                    {channel.quality_label && <span className="text-[#0056A8]">• {channel.quality_label}</span>}
                    {channel.channel_type === 'vod' && <span className="text-purple-400">• VOD</span>}
                  </p>
                </div>
              </div>

              {/* Program Schedule */}
              <div className="flex-1 flex items-center bg-[#2a2a2a] rounded-r-lg overflow-hidden relative">
                <div className="flex gap-0 h-full">
                  {channelPrograms.length > 0 ? (
                    channelPrograms.map((program, pidx) => {
                      const width = calculateProgramWidth(program.duration_minutes);
                      const isProgramSelected = selectedProgramId === program.id;
                      return (
                        <div
                          key={pidx}
                          data-testid={`epg-program-${program.id}`}
                          className={`flex items-center px-3 py-2 border-r border-[#2a2a2a] hover:bg-[#4a4a4a] transition-colors group relative cursor-pointer ${
                            isProgramSelected ? 'bg-[#0056A8]/30' : 'bg-[#3a3a3a]'
                          }`}
                          style={{ width: `${width}px`, minWidth: `${width}px` }}
                          onClick={(e) => { e.stopPropagation(); setSelectedProgramId(program.id); }}
                          title={`${program.title}\n${program.description || ''}\nDuration: ${program.duration_minutes}min${program.quality_label ? '\n' + program.quality_label : ''}`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {program.poster_path && (
                              <img src={`${BACKEND_URL}${program.poster_path}`} alt=""
                                className="w-8 h-8 rounded object-cover flex-shrink-0" />
                            )}
                            <span className="text-white text-sm truncate">{program.title}</span>
                            <Info className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                          {isProgramSelected && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0056A8]" />
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-3 py-2 text-gray-500 text-sm italic">No programs scheduled</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-center">
        <p className="text-gray-600 text-sm">↑↓ arrow keys or D-pad to navigate • Enter to select</p>
      </div>
    </div>
  );
};

export default EPGGrid;
