import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Volume2, VolumeX, Volume1, Maximize2, Minimize2,
  Radio, Wifi, WifiOff, Play, ChevronRight, X, RefreshCw,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const isHLS = (url) => url && (url.includes('.m3u8') || url.includes('/hls/') || url.includes('playlist'));

const getStoredVolume = () => {
  try {
    const v = localStorage.getItem('sv_volume_preference');
    if (v !== null) { const n = parseFloat(v); if (!isNaN(n) && n >= 0 && n <= 1) return n; }
  } catch { /**/ }
  return 0.3;
};
const setStoredVolume = (v) => {
  try { localStorage.setItem('sv_volume_preference', String(v)); } catch { /**/ }
};
const getStoredAutoplay = () => {
  try { const v = localStorage.getItem('sv_autoplay_enabled'); return v === null ? true : v === 'true'; }
  catch { return true; }
};

// Muted category colors (keep in sync with EPGGrid)
const CATEGORY_COLORS = {
  entertainment: { accent: '#3a7fc4', badgeBg: '#0f1e2e', badgeText: '#7ab3d8', label: 'Entertainment' },
  movies:        { accent: '#b07a3a', badgeBg: '#2a1c0a', badgeText: '#c49050', label: 'Cinema'        },
  sports:        { accent: '#3a8f4a', badgeBg: '#0d2414', badgeText: '#72b07e', label: 'Sports'        },
  news:          { accent: '#a84040', badgeBg: '#280f0f', badgeText: '#c07272', label: 'News'          },
  kids:          { accent: '#a0a030', badgeBg: '#262610', badgeText: '#b8b052', label: 'Kids'          },
  music:         { accent: '#9a3a9a', badgeBg: '#250f25', badgeText: '#b87ab8', label: 'Music'         },
  nature:        { accent: '#349494', badgeBg: '#0c2828', badgeText: '#6aacac', label: 'Nature'        },
  tech:          { accent: '#3a5aa0', badgeBg: '#101828', badgeText: '#7090c0', label: 'Tech'          },
  drama:         { accent: '#7a3ab0', badgeBg: '#1c0d2e', badgeText: '#a470c4', label: 'Drama'         },
  lifestyle:     { accent: '#3a9470', badgeBg: '#0d261e', badgeText: '#68b094', label: 'Lifestyle'     },
  gaming:        { accent: '#8a5030', badgeBg: '#200f08', badgeText: '#aa7050', label: 'Gaming'        },
};
const getCat = (cat) => CATEGORY_COLORS[cat] || CATEGORY_COLORS.entertainment;

// ── Shared HLS attachment helper ───────────────────────────────────────────
function attachHLS(src, videoEl, hlsRef, retryRef, { onBuffering, onPlaying, onError, isLiveStream }) {
  if (!videoEl || !src) return;
  if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }

  onBuffering(true);
  onError(false);

  if (isHLS(src)) {
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30, maxBufferLength: 20 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        onBuffering(false);
        if (getStoredAutoplay()) videoEl.play().catch(() => {});
      });
      hls.on(Hls.Events.FRAG_BUFFERED, () => onBuffering(false));
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            retryRef.current = setTimeout(() => { if (hlsRef.current) hlsRef.current.startLoad(); }, 5000);
          } else { onError(true); onBuffering(false); }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = src;
      videoEl.addEventListener('loadedmetadata', () => { onBuffering(false); if (getStoredAutoplay()) videoEl.play().catch(() => {}); }, { once: true });
    } else { onError(true); onBuffering(false); }
  } else {
    videoEl.src = src;
    videoEl.load();
    videoEl.addEventListener('canplay', () => { onBuffering(false); if (getStoredAutoplay()) videoEl.play().catch(() => {}); }, { once: true });
    videoEl.addEventListener('error', () => { onError(true); onBuffering(false); }, { once: true });
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  FULLSCREEN PLAYER OVERLAY
// ══════════════════════════════════════════════════════════════════════════════
const FullscreenPlayer = ({ channel, currentProgram, videoSrc, posterSrc, onClose }) => {
  const fsVideoRef  = useRef(null);
  const fsHlsRef    = useRef(null);
  const fsRetryRef  = useRef(null);
  const hideTimer   = useRef(null);

  const [volume,      setVolume]      = useState(getStoredVolume);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError,    setHasError]    = useState(false);
  const [showCtrl,    setShowCtrl]    = useState(true);
  const [showVolSlider, setShowVolSlider] = useState(false);
  const isLive = !!channel?.stream_url && !currentProgram?.media_file_path;
  const cat = getCat(channel?.category);

  // Start / restart stream
  const startStream = useCallback(() => {
    attachHLS(videoSrc, fsVideoRef.current, fsHlsRef, fsRetryRef, {
      onBuffering: setIsBuffering,
      onPlaying:   () => setIsBuffering(false),
      onError:     setHasError,
      isLiveStream: isLive,
    });
  }, [videoSrc, isLive]);

  useEffect(() => {
    if (videoSrc) startStream();
    return () => {
      if (fsHlsRef.current) { fsHlsRef.current.destroy(); fsHlsRef.current = null; }
      if (fsRetryRef.current) clearTimeout(fsRetryRef.current);
    };
  }, [videoSrc, startStream]);

  // Sync volume
  useEffect(() => {
    if (fsVideoRef.current) { fsVideoRef.current.volume = volume; fsVideoRef.current.muted = false; }
    setStoredVolume(volume);
  }, [volume]);

  // Auto-hide controls after 4 seconds
  const resetHideTimer = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowCtrl(false), 4000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => clearTimeout(hideTimer.current);
  }, [resetHideTimer]);

  // ESC key to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'GoBack') onClose();
      if (e.key === 'ArrowUp')   setVolume(v => Math.min(1, v + 0.05));
      if (e.key === 'ArrowDown') setVolume(v => Math.max(0, v - 0.05));
      resetHideTimer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, resetHideTimer]);

  // Prevent body scroll while fullscreen
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
      onClick={resetHideTimer}
      data-testid="fullscreen-player"
    >
      {/* ── Video ─────────────────────────────────────────────── */}
      <video
        ref={fsVideoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        poster={posterSrc || undefined}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onError={() => { setHasError(true); setIsBuffering(false); }}
        data-testid="fullscreen-video"
      />

      {/* ── Buffering spinner ─────────────────────────────────── */}
      {isBuffering && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full border-4 border-white/20 border-t-white animate-spin" />
        </div>
      )}

      {/* ── Error state ──────────────────────────────────────── */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <WifiOff className="w-14 h-14 text-gray-500" />
          <p className="text-gray-400 text-lg">Stream unavailable</p>
          <button
            onClick={() => { setHasError(false); startStream(); }}
            className="flex items-center gap-2 px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      )}

      {/* ── Controls overlay ─────────────────────────────────── */}
      <div
        className="absolute inset-0 flex flex-col justify-between transition-opacity duration-500"
        style={{ opacity: showCtrl ? 1 : 0, pointerEvents: showCtrl ? 'auto' : 'none' }}
        onClick={(e) => { e.stopPropagation(); resetHideTimer(); }}
      >
        {/* Top bar — channel info + exit */}
        <div
          className="flex items-start justify-between p-5 sm:p-8"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
        >
          <div className="flex items-center gap-3">
            {/* Category color accent dot */}
            <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: cat.accent }} />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white text-2xl sm:text-3xl font-semibold">{channel?.name}</span>
                {isLive && (
                  <span className="flex items-center gap-1 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-300 text-sm">Ch {channel?.number}</span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: cat.badgeBg, color: cat.badgeText }}
                >
                  {cat.label}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/80 flex items-center justify-center transition-colors flex-shrink-0"
            data-testid="fullscreen-close-btn"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tap area — tap anywhere to toggle controls */}
        <div
          className="flex-1 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setShowCtrl(v => !v); if (!showCtrl) resetHideTimer(); }}
          data-testid="fullscreen-tap-area"
        />

        {/* Bottom bar — program info + volume */}
        <div
          className="p-5 sm:p-8"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.90) 0%, transparent 100%)' }}
        >
          {currentProgram && (
            <div className="mb-4">
              <p className="text-white text-xl sm:text-2xl font-semibold leading-tight">{currentProgram.title}</p>
              {currentProgram.description && (
                <p className="text-gray-300 text-sm sm:text-base mt-1.5 line-clamp-2 leading-relaxed max-w-3xl">
                  {currentProgram.description}
                </p>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            {/* Volume control */}
            <div className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); setVolume(v => v === 0 ? (getStoredVolume() || 0.3) : 0); }}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                data-testid="fs-volume-btn"
              >
                {volume === 0 ? <VolumeX className="w-5 h-5 text-white" />
                  : volume < 0.5 ? <Volume1 className="w-5 h-5 text-white" />
                  : <Volume2 className="w-5 h-5 text-white" />}
              </button>
              <div
                className="flex items-center gap-2"
                onMouseEnter={() => setShowVolSlider(true)}
                onMouseLeave={() => setShowVolSlider(false)}
              >
                <input
                  type="range" min="0" max="1" step="0.05" value={volume}
                  onChange={e => { e.stopPropagation(); setVolume(parseFloat(e.target.value)); }}
                  onClick={e => e.stopPropagation()}
                  className="w-24 sm:w-36 accent-white cursor-pointer"
                  style={{ height: 4 }}
                  data-testid="fs-volume-slider"
                />
                <span className="text-white text-sm w-9 text-right">{Math.round(volume * 100)}%</span>
              </div>
            </div>
            {/* Quality / channel info pill */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              {channel?.quality_label && (
                <span className="px-2 py-0.5 bg-white/10 rounded text-white text-xs font-medium">{channel.quality_label}</span>
              )}
              <span className="hidden sm:inline">ESC or ← Back to exit</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  CHANNEL FEATURED (preview card + info panel)
// ══════════════════════════════════════════════════════════════════════════════
const ChannelFeatured = ({ channel, currentProgram, onViewChange }) => {
  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const retryRef   = useRef(null);

  const [volume,         setVolume]         = useState(getStoredVolume);
  const [hasError,       setHasError]       = useState(false);
  const [isBuffering,    setIsBuffering]    = useState(false);
  const [isLive,         setIsLive]         = useState(false);
  const [showControls,   setShowControls]   = useState(false);
  const [showVolSlider,  setShowVolSlider]  = useState(false);
  const [isFullscreen,   setIsFullscreen]   = useState(false);

  const videoSrc = currentProgram?.media_file_path
    ? `${BACKEND_URL}/api${currentProgram.media_file_path}`
    : channel?.stream_url || null;

  const posterSrc = currentProgram?.poster_path
    ? `${BACKEND_URL}/api${currentProgram.poster_path}`
    : null;

  const logoSrc = channel?.logo_path
    ? (channel.logo_path.startsWith('http') ? channel.logo_path : `${BACKEND_URL}/api${channel.logo_path}`)
    : null;

  // ── Destroy HLS ─────────────────────────────────────────────────────────
  const destroyHls = useCallback(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
  }, []);

  // ── Attach stream to preview card ──────────────────────────────────────
  const attachStream = useCallback((src) => {
    const liveStream = !!channel?.stream_url && !currentProgram?.media_file_path;
    setIsLive(liveStream);
    attachHLS(src, videoRef.current, hlsRef, retryRef, {
      onBuffering: setIsBuffering,
      onPlaying:   () => setIsBuffering(false),
      onError:     setHasError,
      isLiveStream: liveStream,
    });
  }, [channel, currentProgram]);

  useEffect(() => {
    if (videoSrc) attachStream(videoSrc);
    else { destroyHls(); setHasError(false); setIsBuffering(false); setIsLive(false); }
    return destroyHls;
  }, [videoSrc, attachStream, destroyHls]);

  useEffect(() => {
    if (videoRef.current) { videoRef.current.volume = volume; videoRef.current.muted = false; }
    setStoredVolume(volume);
  }, [volume]);

  useEffect(() => { if (videoRef.current) videoRef.current.volume = volume; });

  if (!channel) return null;

  // ── VOD Channel ─────────────────────────────────────────────────────────
  if (channel.channel_type === 'vod') {
    return (
      <div className="mb-6">
        <div className="flex items-start gap-5">
          <div className="w-96 h-64 bg-gradient-to-br from-purple-900/60 to-purple-950 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-purple-700/30 shadow-2xl cursor-pointer hover:border-purple-500/50 transition-colors"
            onClick={() => onViewChange?.('ondemand', 'movie')} data-testid="vod-preview-card">
            <div className="text-center">
              <Play className="w-14 h-14 text-purple-300/70 mx-auto mb-3" />
              <p className="text-purple-200 text-base font-medium">Browse Library</p>
              <ChevronRight className="w-5 h-5 text-purple-400/50 mx-auto mt-1" />
            </div>
          </div>
          <div className="flex-1 pt-1 min-w-0">
            <h2 className="text-4xl font-light text-white mb-2">{channel.name}</h2>
            <p className="text-base text-gray-400 mb-4">{channel.number} • On Demand</p>
            <p className="text-base text-gray-300 leading-relaxed">{channel.description}</p>
            <button onClick={() => onViewChange?.('ondemand', 'movie')}
              className="mt-5 flex items-center gap-2 bg-purple-700 hover:bg-purple-600 transition-colors text-white font-semibold px-6 py-3 rounded-xl"
              data-testid="vod-open-btn">
              <Play className="w-4 h-4" /> Open On Demand
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showVideo    = videoSrc && !hasError;
  const showPoster   = !showVideo && posterSrc;
  const showLogo     = !showVideo && !showPoster && logoSrc;
  const showFallback = !showVideo && !showPoster && !showLogo;

  return (
    <>
      {/* ── Fullscreen Player Overlay ──────────────────────────────────────── */}
      {isFullscreen && videoSrc && (
        <FullscreenPlayer
          channel={channel}
          currentProgram={currentProgram}
          videoSrc={videoSrc}
          posterSrc={posterSrc}
          onClose={() => setIsFullscreen(false)}
        />
      )}

      <div className="mb-6">
        <div className="flex items-start gap-5">

          {/* ── Preview Card ──────────────────────────────────────────────── */}
          <div
            className="w-96 h-64 bg-[#0a0a0a] rounded-2xl overflow-hidden relative flex-shrink-0 shadow-2xl border border-gray-700 cursor-pointer"
            onMouseEnter={() => setShowControls(true)}
            onMouseLeave={() => setShowControls(false)}
            onClick={() => {
              if (showVideo) setIsFullscreen(true);
            }}
            data-testid="channel-preview-card"
          >
            {showVideo && (
              <video ref={videoRef} className="w-full h-full object-cover" playsInline autoPlay
                poster={posterSrc || undefined}
                onWaiting={() => setIsBuffering(true)}
                onPlaying={() => setIsBuffering(false)}
                onError={() => { setHasError(true); setIsBuffering(false); }} />
            )}
            {showPoster && <img src={posterSrc} alt={currentProgram?.title || channel.name} className="w-full h-full object-cover" />}
            {showLogo && (
              <div className="w-full h-full bg-gradient-to-br from-[#0056A8] to-[#003d7a] flex items-center justify-center p-6">
                <img src={logoSrc} alt={channel.name} className="w-full h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }} />
              </div>
            )}
            {showFallback && !hasError && (
              <div className="w-full h-full bg-gradient-to-br from-[#0056A8] to-[#003d7a] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-white text-7xl font-bold leading-none">{channel.number}</div>
                  <div className="text-blue-200 text-base mt-3 font-medium">{channel.name}</div>
                  <div className="mt-4 flex items-center justify-center gap-1.5 text-blue-300/60 text-xs">
                    <WifiOff className="w-3.5 h-3.5" /> No stream configured
                  </div>
                </div>
              </div>
            )}
            {hasError && (
              <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-2">
                <WifiOff className="w-10 h-10 text-gray-600" />
                <p className="text-gray-500 text-sm">Stream unavailable</p>
                <button onClick={(e) => { e.stopPropagation(); attachStream(videoSrc); }}
                  className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline">Retry</button>
              </div>
            )}
            {isBuffering && showVideo && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                <div className="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin" style={{ borderWidth: 3 }} />
              </div>
            )}
            {isLive && showVideo && !hasError && (
              <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
              </div>
            )}

            {/* Hover overlay — click to go fullscreen */}
            {showVideo && (
              <div className={`absolute inset-0 transition-opacity duration-200 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
                {/* Centre play/expand hint */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
                    <Maximize2 className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  {/* Volume */}
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full"
                    onMouseEnter={() => setShowVolSlider(true)}
                    onMouseLeave={() => setShowVolSlider(false)}
                    onClick={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); setVolume(v => v === 0 ? getStoredVolume() || 0.3 : 0); }}
                      className="flex items-center justify-center hover:text-white transition-colors text-white/80"
                      data-testid="volume-toggle-btn">
                      {volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    {showVolSlider && (
                      <>
                        <input type="range" min="0" max="1" step="0.05" value={volume}
                          onChange={e => { e.stopPropagation(); setVolume(parseFloat(e.target.value)); }}
                          onClick={e => e.stopPropagation()}
                          className="w-20 accent-white cursor-pointer" style={{ height: 4 }}
                          data-testid="volume-slider" />
                        <span className="text-white text-xs w-7 text-center">{Math.round(volume * 100)}%</span>
                      </>
                    )}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
                    className="w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-colors"
                    data-testid="fullscreen-btn">
                    <Maximize2 className="w-4 h-4 text-white" />
                  </button>
                </div>
                {volume === 0 && (
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white/60 text-xs pointer-events-none">
                    <VolumeX className="w-3.5 h-3.5" /> Muted
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Channel & Program Info ─────────────────────────────────────── */}
          <div className="flex-1 pt-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-4xl font-light text-white truncate">{channel.name}</h2>
              {isLive && showVideo && !hasError && (
                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                  <Wifi className="w-3 h-3" /> Streaming
                </span>
              )}
            </div>
            <p className="text-base text-gray-400 mb-3">
              {channel.number} • {channel.quality_label || 'HD'}
            </p>
            {currentProgram ? (
              <div>
                <p className="text-lg text-white font-medium truncate">{currentProgram.title}</p>
                <p className="text-sm text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                  {currentProgram.description || channel.description}
                </p>
                {currentProgram.duration_formatted && (
                  <p className="text-xs text-gray-500 mt-2">Duration: {currentProgram.duration_formatted}</p>
                )}
              </div>
            ) : (
              <p className="text-base text-gray-300 leading-relaxed line-clamp-3">{channel.description}</p>
            )}

            {/* Watch button — only shown when stream is available */}
            {videoSrc && !hasError && (
              <button
                onClick={() => setIsFullscreen(true)}
                className="mt-5 flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-xl transition-all hover:scale-105 active:scale-95"
                style={{ background: `linear-gradient(135deg, ${getCat(channel.category).accent}cc, ${getCat(channel.category).accent}66)`, border: `1px solid ${getCat(channel.category).accent}55` }}
                data-testid="watch-fullscreen-btn"
              >
                <Play className="w-4 h-4" />
                Watch Full Screen
              </button>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default ChannelFeatured;
