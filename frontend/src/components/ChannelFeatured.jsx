import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import { Volume2, VolumeX, Maximize2, Radio, Wifi, WifiOff } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Detect if a URL is an HLS stream
const isHLS = (url) => url && (url.includes('.m3u8') || url.includes('/hls/') || url.includes('playlist'));

const ChannelFeatured = ({ channel, currentProgram }) => {
  const videoRef    = useRef(null);
  const hlsRef      = useRef(null);
  const retryRef    = useRef(null);

  const [isMuted,      setIsMuted]      = useState(true);
  const [hasError,     setHasError]     = useState(false);
  const [isBuffering,  setIsBuffering]  = useState(false);
  const [isLive,       setIsLive]       = useState(false);
  const [showControls, setShowControls] = useState(false);

  const videoSrc = currentProgram?.media_file_path
    ? `${BACKEND_URL}/api${currentProgram.media_file_path}`
    : channel?.stream_url || null;

  const posterSrc = currentProgram?.poster_path
    ? `${BACKEND_URL}/api${currentProgram.poster_path}`
    : null;

  const logoSrc = channel?.logo_path
    ? (channel.logo_path.startsWith('http') ? channel.logo_path : `${BACKEND_URL}/api${channel.logo_path}`)
    : null;

  // ── Destroy any existing HLS instance ─────────────────────────────────────
  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  // ── Attach stream to video element ─────────────────────────────────────────
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
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 20,
          maxMaxBufferLength: 30,
        });
        hlsRef.current = hls;

        hls.loadSource(src);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsBuffering(false);
          video.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Auto-retry after 5 s
              retryRef.current = setTimeout(() => {
                if (hlsRef.current) {
                  hlsRef.current.startLoad();
                }
              }, 5000);
            } else {
              setHasError(true);
              setIsBuffering(false);
            }
          }
        });

        hls.on(Hls.Events.FRAG_BUFFERED, () => setIsBuffering(false));

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS
        video.src = src;
        video.addEventListener('loadedmetadata', () => {
          setIsBuffering(false);
          video.play().catch(() => {});
        }, { once: true });
      } else {
        setHasError(true);
        setIsBuffering(false);
      }
    } else {
      // Regular MP4 / WebM / direct stream
      video.src = src;
      video.load();
      video.addEventListener('canplay', () => {
        setIsBuffering(false);
        video.play().catch(() => {});
      }, { once: true });
      video.addEventListener('error', () => {
        setHasError(true);
        setIsBuffering(false);
      }, { once: true });
    }
  }, [channel, currentProgram, destroyHls]);

  // Re-attach whenever channel or program changes
  useEffect(() => {
    if (videoSrc) {
      attachStream(videoSrc);
    } else {
      destroyHls();
      setHasError(false);
      setIsBuffering(false);
      setIsLive(false);
    }
    return destroyHls;
  }, [videoSrc, attachStream, destroyHls]);

  // Sync muted state to video element
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  const handleFullscreen = () => {
    const el = videoRef.current;
    if (!el) return;
    (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen)?.call(el);
  };

  if (!channel) return null;

  const showVideo   = videoSrc && !hasError;
  const showPoster  = !showVideo && posterSrc;
  const showLogo    = !showVideo && !showPoster && logoSrc;
  const showFallback = !showVideo && !showPoster && !showLogo;

  return (
    <div className="mb-6">
      <div className="flex items-start gap-5">

        {/* ── Preview Card ──────────────────────────────────────────────────── */}
        <div
          className="w-96 h-64 bg-[#0a0a0a] rounded-2xl overflow-hidden relative flex-shrink-0 shadow-2xl border border-gray-700 cursor-pointer"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
          onClick={() => showVideo && setIsMuted(m => !m)}
          data-testid="channel-preview-card"
        >
          {/* Video layer */}
          {showVideo && (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted={isMuted}
              playsInline
              autoPlay
              poster={posterSrc || undefined}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onError={() => { setHasError(true); setIsBuffering(false); }}
            />
          )}

          {/* Poster (no stream, has poster image) */}
          {showPoster && (
            <img src={posterSrc} alt={currentProgram?.title || channel.name}
              className="w-full h-full object-cover" />
          )}

          {/* Logo on gradient */}
          {showLogo && (
            <div className="w-full h-full bg-gradient-to-br from-[#0056A8] to-[#003d7a] flex items-center justify-center p-6">
              <img src={logoSrc} alt={channel.name} className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          )}

          {/* Blue number fallback */}
          {showFallback && !hasError && (
            <div className="w-full h-full bg-gradient-to-br from-[#0056A8] to-[#003d7a] flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-7xl font-bold leading-none">{channel.number}</div>
                <div className="text-blue-200 text-base mt-3 font-medium">{channel.name}</div>
                <div className="mt-4 flex items-center justify-center gap-1.5 text-blue-300/60 text-xs">
                  <WifiOff className="w-3.5 h-3.5" />
                  No stream configured
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {hasError && (
            <div className="w-full h-full bg-[#0a0a0a] flex flex-col items-center justify-center gap-2">
              <WifiOff className="w-10 h-10 text-gray-600" />
              <p className="text-gray-500 text-sm">Stream unavailable</p>
              <button
                onClick={(e) => { e.stopPropagation(); attachStream(videoSrc); }}
                className="mt-1 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Buffering spinner */}
          {isBuffering && showVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
              <div className="w-10 h-10 border-3 border-white/20 border-t-white rounded-full animate-spin" style={{ borderWidth: 3 }} />
            </div>
          )}

          {/* LIVE badge */}
          {isLive && showVideo && !hasError && (
            <div className="absolute top-3 left-3 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          )}

          {/* Hover controls */}
          {showVideo && (
            <div className={`absolute inset-0 transition-opacity duration-200 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMuted(m => !m); }}
                  className="w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-colors"
                  data-testid="mute-toggle-btn"
                >
                  {isMuted
                    ? <VolumeX className="w-4 h-4 text-white" />
                    : <Volume2 className="w-4 h-4 text-white" />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
                  className="w-9 h-9 rounded-full bg-black/60 backdrop-blur flex items-center justify-center hover:bg-black/80 transition-colors"
                  data-testid="fullscreen-btn"
                >
                  <Maximize2 className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Click to unmute hint */}
              {isMuted && (
                <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-white/60 text-xs pointer-events-none">
                  <VolumeX className="w-3.5 h-3.5" />
                  Click to unmute
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Channel & Program Info ─────────────────────────────────────────── */}
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
            {channel.channel_type === 'vod' && (
              <span className="ml-2 px-2 py-0.5 bg-purple-700 text-white text-xs rounded">VOD</span>
            )}
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
        </div>

      </div>
    </div>
  );
};

export default ChannelFeatured;
