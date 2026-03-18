import React, { useEffect, useRef, useState } from 'react';
import { Info, Clock, Tv, Play, ChevronRight } from 'lucide-react';

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

const EPGGrid = ({ channels, programs, timeSlots, selectedChannelId, onChannelSelect, onViewChange }) => {
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
            const ch = channels[next];
            if (ch?.coming_soon) return next;
            if (ch?.channel_type === 'vod') { onViewChange?.('ondemand', 'movie'); return next; }
            onChannelSelect(ch);
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedChannelIdx(prev => {
            const next = Math.max(prev - 1, 0);
            const ch = channels[next];
            if (ch?.coming_soon) return next;
            if (ch?.channel_type === 'vod') { onViewChange?.('ondemand', 'movie'); return next; }
            onChannelSelect(ch);
            return next;
          });
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (channels[focusedChannelIdx]) {
            const ch = channels[focusedChannelIdx];
            if (ch.coming_soon) setShowComingSoon(true);
            else if (ch.channel_type === 'vod') onViewChange?.('ondemand', 'movie');
            else onChannelSelect(ch);
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
      <div className="flex mb-3 sticky top-0 z-10">
        <div className="w-36 sm:w-44 lg:w-52 flex-shrink-0 px-2 sm:px-3 py-2 bg-[#1a1a1a]">
          <span className="text-base text-gray-400 font-light">Today</span>
        </div>
        <div className="flex gap-0">
          {timeSlots.map((time, index) => (
            <div
              key={index}
              className="w-[160px] px-3 py-2 flex-shrink-0 border-r"
              style={{
                background: '#14092e',
                borderRightColor: 'rgba(139,92,246,0.12)',
              }}
            >
              <span className="text-sm text-purple-200/80 font-medium whitespace-nowrap">{time}</span>
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
          const isVOD = channel.channel_type === 'vod';
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
                else if (isVOD) onViewChange?.('ondemand', 'movie');
                else onChannelSelect(channel);
              }}
            >
              {/* Channel Info */}
              <div
                className={`w-36 sm:w-44 lg:w-52 flex-shrink-0 flex items-center gap-2 px-2 sm:px-3 py-2 bg-[#2a2a2a] rounded-l-lg ${
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
                    {channel.quality_label && !isComingSoon && !isVOD && <span className="text-[#0056A8]">• {channel.quality_label}</span>}
                    {isComingSoon && <span className="text-blue-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Coming Soon</span>}
                    {isVOD && <span className="text-purple-400 flex items-center gap-1"><Play className="w-3 h-3" /> On Demand</span>}
                  </p>
                </div>
              </div>

              {/* Program Schedule */}
              <div
                className="flex-1 flex items-center rounded-r-lg overflow-hidden relative"
                style={{ background: '#0f0820' }}
              >
                {isComingSoon ? (
                  <div
                    className="flex items-center px-5 py-3"
                    style={{ minWidth: `${timeSlots.length * 160}px` }}
                  >
                    <Clock className="w-4 h-4 text-purple-400/50 flex-shrink-0 mr-2" />
                    <span className="text-purple-400/50 text-sm italic">Programming not yet available</span>
                  </div>
                ) : isVOD ? (
                  <div className="flex-1 flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-white font-medium text-sm">On Demand</p>
                      <p className="text-purple-300/50 text-xs mt-0.5">Browse the full library</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 transition-colors text-white text-sm font-semibold px-4 py-1.5 rounded-lg cursor-pointer mr-2"
                      data-testid="vod-browse-btn">
                      Browse <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ) : channelPrograms.length > 0 ? (
                  <>
                    {channelPrograms.map((program, pidx) => {
                      const width = calculateProgramWidth(program.duration_minutes);
                      const isProgramSelected = selectedProgramId === program.id;
                      return (
                        <div
                          key={pidx}
                          data-testid={`epg-program-${program.id}`}
                          className="group relative cursor-pointer flex-shrink-0 transition-all duration-150 self-stretch flex items-center"
                          style={{
                            width: `${width}px`,
                            minWidth: `${width}px`,
                            background: isProgramSelected ? '#2c1a60' : '#1c1040',
                            borderRight: '1px solid rgba(139,92,246,0.15)',
                          }}
                          onClick={(e) => { e.stopPropagation(); setSelectedProgramId(program.id); }}
                          title={`${program.title}\n${program.description || ''}\nDuration: ${program.duration_minutes}min`}
                          onMouseEnter={e => { if (!isProgramSelected) e.currentTarget.style.background = '#251450'; }}
                          onMouseLeave={e => { if (!isProgramSelected) e.currentTarget.style.background = '#1c1040'; }}
                        >
                          <div className="flex items-center gap-2 px-3 py-3 min-w-0 w-full">
                            {program.poster_path && (
                              <img src={`${BACKEND_URL}/api${program.poster_path}`} alt=""
                                className="w-9 h-9 rounded-md object-cover flex-shrink-0 ring-1 ring-purple-700/50" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-semibold truncate leading-tight">{program.title}</p>
                              {program.description && width >= 240 && (
                                <p className="text-purple-300/60 text-xs truncate mt-0.5 leading-tight">{program.description}</p>
                              )}
                            </div>
                            <Info className="w-3 h-3 text-purple-400/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                          {isProgramSelected && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
                          )}
                          {isProgramSelected && (
                            <div className="absolute top-0 left-0 right-0 h-0.5 bg-purple-500" />
                          )}
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div
                    className="flex items-center"
                    style={{ minWidth: `${timeSlots.length * 160}px` }}
                  >
                    <span className="px-4 text-purple-400/30 text-xs italic">No schedule</span>
                  </div>
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
