import React, { useEffect, useRef, useState } from 'react';
import { Info, Clock, Tv } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ComingSoonModal = ({ onClose }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center"
    style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
    onClick={onClose}
    data-testid="coming-soon-modal"
  >
    <div
      className="relative bg-[#1a1a2e] border border-blue-800/50 rounded-2xl p-10 max-w-md w-full mx-6 text-center shadow-2xl"
      onClick={e => e.stopPropagation()}
    >
      <div className="w-16 h-16 bg-gradient-to-br from-[#0056A8] to-[#003d7a] rounded-2xl flex items-center justify-center mx-auto mb-5">
        <Tv className="w-8 h-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-3">Live TV Channels Coming Soon</h2>
      <p className="text-gray-300 text-base leading-relaxed mb-8">
        Stay tuned for updates on when live TV will be added.
      </p>
      <button
        onClick={onClose}
        className="px-8 py-3 bg-[#0056A8] hover:bg-[#0066c8] text-white font-semibold rounded-xl transition-colors"
        data-testid="coming-soon-close-btn"
      >
        Got It
      </button>
    </div>
  </div>
);

const EPGGrid = ({ channels, programs, timeSlots, selectedChannelId, onChannelSelect }) => {
  const [focusedChannelIdx, setFocusedChannelIdx] = useState(0);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
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
            if (!channels[next]?.coming_soon) onChannelSelect(channels[next]);
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedChannelIdx(prev => {
            const next = Math.max(prev - 1, 0);
            if (!channels[next]?.coming_soon) onChannelSelect(channels[next]);
            return next;
          });
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (channels[focusedChannelIdx]) {
            if (channels[focusedChannelIdx].coming_soon) setShowComingSoon(true);
            else onChannelSelect(channels[focusedChannelIdx]);
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
    return `${BACKEND_URL}/api${channel.logo_path}`;
  };

  const getLogoFallback = (channel, e) => {
    e.target.style.display = 'none';
    e.target.nextSibling && (e.target.nextSibling.style.display = 'flex');
  };

  return (
    <div className="overflow-x-auto" ref={containerRef} tabIndex={-1}>
      {showComingSoon && <ComingSoonModal onClose={() => setShowComingSoon(false)} />}

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
          const isComingSoon = !!channel.coming_soon;
          const channelPrograms = getProgramsForChannel(channel.id);
          const logoSrc = getLogoSrc(channel);

          return (
            <div
              key={channel.id}
              data-testid={`epg-channel-row-${channel.id}`}
              className={`flex transition-all duration-200 ${
                isComingSoon ? 'opacity-50 cursor-pointer' : 'cursor-pointer'
              } ${isSelected && !isComingSoon ? 'scale-[1.01]' : ''}`}
              onClick={() => {
                setFocusedChannelIdx(idx);
                if (isComingSoon) setShowComingSoon(true);
                else onChannelSelect(channel);
              }}
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
                    {channel.quality_label && !isComingSoon && <span className="text-[#0056A8]">• {channel.quality_label}</span>}
                    {isComingSoon && <span className="text-blue-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Coming Soon</span>}
                    {channel.channel_type === 'vod' && <span className="text-purple-400">• VOD</span>}
                  </p>
                </div>
              </div>

              {/* Program Schedule */}
              <div className="flex-1 flex items-center bg-[#2a2a2a] rounded-r-lg overflow-hidden relative">
                {isComingSoon ? (
                  <div className="px-5 py-2 text-gray-600 text-sm italic flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Programming not yet available
                  </div>
                ) : channelPrograms.length > 0 ? (
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
                            <img src={`${BACKEND_URL}/api${program.poster_path}`} alt=""
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
