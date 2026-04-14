import React, { useEffect, useRef, useState } from 'react';
import { Info, Clock, Tv, Play, ChevronRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Muted, TV-friendly category color palette
const CATEGORY_COLORS = {
  entertainment: { accent: '#3a7fc4', badgeBg: '#0f1e2e', badgeText: '#7ab3d8', label: 'Entertainment' },
  movies:        { accent: '#b07a3a', badgeBg: '#2a1c0a', badgeText: '#c49050', label: 'Cinema'        },
  action:        { accent: '#c04a2a', badgeBg: '#2c100a', badgeText: '#d07050', label: 'Action'        },
  sports:        { accent: '#3a8f4a', badgeBg: '#0d2414', badgeText: '#72b07e', label: 'Sports'        },
  news:          { accent: '#a84040', badgeBg: '#280f0f', badgeText: '#c07272', label: 'News'          },
  kids:          { accent: '#a0a030', badgeBg: '#262610', badgeText: '#b8b052', label: 'Kids'          },
  music:         { accent: '#9a3a9a', badgeBg: '#250f25', badgeText: '#b87ab8', label: 'Music'         },
  nature:        { accent: '#349494', badgeBg: '#0c2828', badgeText: '#6aacac', label: 'Nature'        },
  tech:          { accent: '#3a5aa0', badgeBg: '#101828', badgeText: '#7090c0', label: 'Tech'          },
  drama:         { accent: '#7a3ab0', badgeBg: '#1c0d2e', badgeText: '#a470c4', label: 'Drama'         },
  lifestyle:     { accent: '#3a9470', badgeBg: '#0d261e', badgeText: '#68b094', label: 'Lifestyle'     },
  gaming:        { accent: '#8a5030', badgeBg: '#200f08', badgeText: '#aa7050', label: 'Gaming'        },
  family:        { accent: '#4a90c0', badgeBg: '#0f2030', badgeText: '#80b8d8', label: 'Family'        },
  sitcom:        { accent: '#5aaa6a', badgeBg: '#102818', badgeText: '#82c492', label: 'Sitcom'        },
  science:       { accent: '#2a8a9a', badgeBg: '#0a2428', badgeText: '#60b0b8', label: 'Science'       },
  gameshow:      { accent: '#c09030', badgeBg: '#2a200a', badgeText: '#d0a850', label: 'Gameshow'      },
  comedy:        { accent: '#d0803a', badgeBg: '#2c1c0a', badgeText: '#e0a060', label: 'Comedy'        },
  latenight:     { accent: '#505090', badgeBg: '#141428', badgeText: '#8080b0', label: 'Late Night'    },
  holiday:       { accent: '#c04040', badgeBg: '#2c0f0f', badgeText: '#d87070', label: 'Holiday'       },
  crime:         { accent: '#606060', badgeBg: '#1a1a1a', badgeText: '#909090', label: 'Crime'         },
};

const getCategoryColors = (category) =>
  CATEGORY_COLORS[category] || CATEGORY_COLORS.entertainment;

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

const EPGGrid = ({ channels, programs, timeSlots, selectedChannelId, onChannelSelect, onChannelPlay, onViewChange }) => {
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
            // Arrow keys only update the preview panel, never play
            if (ch && !ch.coming_soon && ch.channel_type !== 'vod') onChannelSelect(ch);
            return next;
          });
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedChannelIdx(prev => {
            const next = Math.max(prev - 1, 0);
            const ch = channels[next];
            if (ch && !ch.coming_soon && ch.channel_type !== 'vod') onChannelSelect(ch);
            return next;
          });
          break;
        case 'Enter':
        case ' ':
          // OK button / Enter → play immediately full screen
          e.preventDefault();
          if (channels[focusedChannelIdx]) {
            const ch = channels[focusedChannelIdx];
            if (ch.coming_soon) { setShowComingSoon(true); return; }
            onChannelPlay?.(ch);
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels, focusedChannelIdx, onChannelSelect, onChannelPlay, onViewChange]);

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
                isComingSoon ? 'opacity-55 cursor-pointer' : 'cursor-pointer'
              } ${isSelected && !isComingSoon ? 'scale-[1.01]' : ''}`}
              onClick={() => {
                setFocusedChannelIdx(idx);
                if (isComingSoon) { setShowComingSoon(true); return; }
                // Click = play immediately
                onChannelPlay?.(channel);
              }}
            >
              {/* Channel Info */}
              <div
                className={`w-36 sm:w-44 lg:w-52 flex-shrink-0 flex items-center gap-2 px-2 sm:px-3 py-2 rounded-l-lg overflow-hidden relative ${
                  isSelected ? 'ring-2 ring-white/70' : isFocused ? 'ring-2 ring-blue-500/60' : ''
                }`}
                style={{
                  background: '#202020',
                  borderLeft: `3px solid ${isVOD ? '#7c3aed' : isComingSoon ? '#374151' : getCategoryColors(channel.category).accent}`,
                }}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#333] rounded-md overflow-hidden flex-shrink-0 relative">
                  {logoSrc ? (
                    <>
                      <img
                        src={logoSrc}
                        alt={channel.name}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => getLogoFallback(channel, e)}
                      />
                      <div className="w-full h-full items-center justify-center bg-[#0056A8] absolute inset-0 hidden">
                        <span className="text-white text-xs font-bold">{channel.number}</span>
                      </div>
                    </>
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ background: getCategoryColors(channel.category).badgeBg }}
                    >
                      <span className="text-xs font-bold" style={{ color: getCategoryColors(channel.category).accent }}>{channel.number}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate leading-tight">{channel.name}</p>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {isComingSoon ? (
                      <span className="text-gray-500 text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Soon</span>
                    ) : isVOD ? (
                      <span className="text-purple-400 text-xs flex items-center gap-1"><Play className="w-3 h-3" /> On Demand</span>
                    ) : (
                      <>
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none"
                          style={{ background: getCategoryColors(channel.category).badgeBg, color: getCategoryColors(channel.category).badgeText }}
                          data-testid={`channel-category-badge-${channel.id}`}
                        >
                          {getCategoryColors(channel.category).label}
                        </span>
                        {channel.quality_label && (
                          <span className="text-gray-500 text-[10px]">{channel.quality_label}</span>
                        )}
                      </>
                    )}
                  </div>
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
