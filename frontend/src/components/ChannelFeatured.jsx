import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Volume2, VolumeX, Volume1, Radio, Wifi, WifiOff, Play, ChevronRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const isHLS = (url) => url && (url.includes('.m3u8') || url.includes('/hls/') || url.includes('playlist'));

const getStoredVolume = () => {
  try {
    const v = localStorage.getItem('sv_volume_preference');
    if (v !== null) { const num = parseFloat(v); if (!isNaN(num) && num >= 0 && num <= 1) return num; }
  } catch { /* ignore */ }
  return 0.3;
};
const setStoredVolume = (v) => {
  try { localStorage.setItem('sv_volume_preference', String(v)); } catch { /* ignore */ }
};

const getStoredAutoplay = () => {
  try { const v = localStorage.getItem('sv_autoplay_enabled'); return v === null ? true : v === 'true'; }
  catch { return true; }
};

const ChannelFeatured = ({ channel, currentProgram, onViewChange }) => {
  const videoRef   = useRef(null);
  const hlsRef     = useRef(null);
  const retryRef   = useRef(null);

  const [volume,        setVolume]        = useState(getStoredVolume);
  const [hasError,      setHasError]      = useState(false);
  const [isBuffering,   setIsBuffering]   = useState(false);
  const [isLive,        setIsLive]        = useState(false);
  const [showControls,  setShowControls]  = useState(false);
  const [showVolSlider, setShowVolSlider] = useState(false);

  const videoSrc = currentProgram?.media_file_path
    ? `${BACKEND_URL}/api${currentProgram.media_file_path}`
    : channel?.media_file_path
    ? `${BACKEND_URL}/api${channel.media_file_path}`
    : channel?.stream_url || null;

  const posterSrc = currentProgram?.poster_path
    ? `${BACKEND_URL}/api${currentProgram.poster_path}`
    : null;

  const logoSrc = channel?.logo_path
    ? (channel.logo_path.startsWith('http') ? channel.logo_path : `${BACKEND_URL}/api${channel.logo_path}`)
    : null;

  const destroyHls = useCallback(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
  }, []);

  const attachStream = useCallback((src) => {
    const video = videoRef.current;
    if (!video || !src) return;
    destroyHls();
    setHasError(false);
    setIsBuffering(true);
    const liveStream = !!channel?.stream_url && !currentProgram?.media_file_path;
    setIsLive(liveStream);
    if (isHLS(src)) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30, maxBufferLength: 20 });
        hlsRef.current = hls;
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          if (getStoredAutoplay()) video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              retryRef.current = setTimeout(() => hlsRef.current?.startLoad(), 5000);
            } else { setHasError(true); setIsBuffering(false); }
          }
        });
        hls.on(Hls.Events.FRAG_BUFFERED, () => setIsBuffering(false));
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        video.addEventListener('loadedmetadata', () => { setIsBuffering(false); if (getStoredAutoplay()) video.play().catch(() => {}); }, { once: true });
      } else { setHasError(true); setIsBuffering(false); }
    } else {
      video.src = src; video.load();
      video.addEventListener('canplay', () => { setIsBuffering(false); if (getStoredAutoplay()) video.play().catch(() => {}); }, { once: true });
      video.addEventListener('error',   () => { setHasError(true); setIsBuffering(false); }, { once: true });
    }
  }, [channel, currentProgram, destroyHls]);

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
    <div className="mb-6">
      <div className="flex items-start gap-5">

        {/* ── Preview Card (muted thumbnail only) ───────────────────────── */}
        <div
          className="w-96 h-64 bg-[#0a0a0a] rounded-2xl overflow-hidden relative flex-shrink-0 shadow-2xl border border-gray-700"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
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
          {/* Volume control on hover — preview only */}
          {showVideo && showControls && (
            <div className="absolute bottom-3 right-3 flex items-center gap-2"
              onMouseEnter={() => setShowVolSlider(true)}
              onMouseLeave={() => setShowVolSlider(false)}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full">
                <button onClick={() => setVolume(v => v === 0 ? getStoredVolume() || 0.3 : 0)}
                  className="text-white/80 hover:text-white" data-testid="volume-toggle-btn">
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : volume < 0.5 ? <Volume1 className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                {showVolSlider && (
                  <>
                    <input type="range" min="0" max="1" step="0.05" value={volume}
                      onChange={e => setVolume(parseFloat(e.target.value))}
                      className="w-20 accent-white cursor-pointer" style={{ height: 4 }}
                      data-testid="volume-slider" />
                    <span className="text-white text-xs w-7 text-center">{Math.round(volume * 100)}%</span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Channel & Program Info ──────────────────────────────────────── */}
        <div className="flex-1 pt-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-4xl font-light text-white truncate">{channel.name}</h2>
            {isLive && showVideo && !hasError && (
              <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                <Wifi className="w-3 h-3" /> Streaming
              </span>
            )}
          </div>
          <p className="text-base text-gray-400 mb-3">{channel.number} • {channel.quality_label || 'HD'}</p>
          {currentProgram ? (
            <div>
              <p className="text-lg text-white font-medium truncate">{currentProgram.title}</p>
              <p className="text-sm text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                {currentProgram.description || channel.description}
              </p>
            </div>
          ) : (
            <p className="text-base text-gray-300 leading-relaxed line-clamp-3">{channel.description}</p>
          )}
        </div>

      </div>
    </div>
  );
};

export default ChannelFeatured;

