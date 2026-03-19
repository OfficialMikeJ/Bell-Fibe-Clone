/**
 * FullscreenPlayer — zero UI, pure video.
 *
 * Remote / keyboard behaviour:
 *   ↑ / ↓          Browse channels (overlay appears, video switches after 1 s debounce)
 *   OK / Enter      Immediately switch to browsed channel
 *   Back / ESC      Exit to guide
 *
 * VOD usage: pass channels=[] to disable channel navigation entirely.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Hls from 'hls.js';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const isHLS = (url) =>
  url && (url.includes('.m3u8') || url.includes('/hls/') || url.includes('playlist'));

const getStoredVolume = () => {
  try {
    const v = localStorage.getItem('sv_volume_preference');
    if (v !== null) { const n = parseFloat(v); if (!isNaN(n) && n >= 0 && n <= 1) return n; }
  } catch { /**/ }
  return 0.3;
};

// Muted category colour map (keep in sync with EPGGrid)
const CAT = {
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
const getCat = (cat) => CAT[cat] || CAT.entertainment;

// ── Resolve video URL from a channel + optional program ──────────────────────
const resolveVideoSrc = (ch, prog) => {
  if (prog?.media_file_path)  return `${BACKEND_URL}/api${prog.media_file_path}`;
  if (ch?.media_file_path)    return `${BACKEND_URL}/api${ch.media_file_path}`;
  if (ch?.stream_url)         return ch.stream_url;
  return null;
};

// ── HLS / direct attach ───────────────────────────────────────────────────────
const startStream = (src, videoEl, hlsRef, retryRef) => {
  if (hlsRef.current)  { hlsRef.current.destroy();  hlsRef.current  = null; }
  if (retryRef.current){ clearTimeout(retryRef.current); retryRef.current = null; }
  if (!src || !videoEl) return;

  videoEl.volume = getStoredVolume();

  if (isHLS(src)) {
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(videoEl);
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoEl.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          retryRef.current = setTimeout(() => hlsRef.current?.startLoad(), 5000);
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = src;
      videoEl.addEventListener('loadedmetadata', () => videoEl.play().catch(() => {}), { once: true });
    }
  } else {
    videoEl.src = src;
    videoEl.load();
    videoEl.addEventListener('canplay', () => videoEl.play().catch(() => {}), { once: true });
  }
};

// ── Channel row shown in the browse overlay ───────────────────────────────────
const ChannelRow = ({ ch, isBrowsed }) => {
  const cat = getCat(ch?.category);
  return (
    <div className={`flex items-center gap-3 transition-all duration-200 ${isBrowsed ? 'opacity-100' : 'opacity-35'}`}>
      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ background: isBrowsed ? cat.accent : '#555' }} />
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-mono flex-shrink-0 ${isBrowsed ? 'text-white text-lg font-semibold' : 'text-gray-400 text-sm'}`}>
          {ch?.number}
        </span>
        <span className={`truncate ${isBrowsed ? 'text-white text-xl font-semibold' : 'text-gray-400 text-sm'}`}>
          {ch?.name}
        </span>
        {isBrowsed && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
            style={{ background: cat.badgeBg, color: cat.badgeText }}>
            {cat.label}
          </span>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
const FullscreenPlayer = ({
  channel,
  currentProgram,
  channels   = [],   // Full channel list for up/down navigation. Pass [] for VOD.
  getProgram,        // (channelId) => program | null
  onClose,
}) => {
  const videoRef    = useRef(null);
  const hlsRef      = useRef(null);
  const retryRef    = useRef(null);
  const switchTimer = useRef(null);
  const overlayTimer= useRef(null);

  // Only playable channels (skip coming_soon and VOD)
  const playable = useMemo(
    () => channels.filter(c => !c.coming_soon && c.channel_type !== 'vod'),
    [channels]
  );

  const initialIdx = useMemo(
    () => Math.max(0, playable.findIndex(c => c.id === channel?.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [activeIdx,   setActiveIdx]   = useState(initialIdx);
  const [browseIdx,   setBrowseIdx]   = useState(initialIdx);
  const [showOverlay, setShowOverlay] = useState(false);

  const activeChannel = playable[activeIdx] ?? channel;
  const browseChannel = playable[browseIdx] ?? channel;

  const activeProgram = getProgram ? getProgram(activeChannel?.id) : currentProgram;
  const videoSrc      = resolveVideoSrc(activeChannel, activeProgram);
  const posterSrc     = activeProgram?.poster_path
    ? `${BACKEND_URL}/api${activeProgram.poster_path}` : null;

  // ── Stream management ──────────────────────────────────────────────────────
  useEffect(() => {
    startStream(videoSrc, videoRef.current, hlsRef, retryRef);
    return () => {
      if (hlsRef.current)   { hlsRef.current.destroy();        hlsRef.current   = null; }
      if (retryRef.current) { clearTimeout(retryRef.current);  retryRef.current = null; }
    };
  }, [videoSrc]);

  // ── Overlay dismiss timer ──────────────────────────────────────────────────
  const resetOverlayTimer = useCallback(() => {
    clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => setShowOverlay(false), 3000);
  }, []);

  // ── Navigate while in fullscreen ───────────────────────────────────────────
  const navigate = useCallback((dir) => {
    if (playable.length === 0) return;

    setBrowseIdx(prev => {
      const next = dir === 'up'
        ? Math.max(0, prev - 1)
        : Math.min(playable.length - 1, prev + 1);

      setShowOverlay(true);
      resetOverlayTimer();

      // Debounce: only switch video 1 second after the last keypress
      clearTimeout(switchTimer.current);
      switchTimer.current = setTimeout(() => {
        setActiveIdx(next);
      }, 1000);

      return next;
    });
  }, [playable, resetOverlayTimer]);

  // ── Keyboard / remote handler ──────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          navigate('up');
          break;
        case 'ArrowDown':
          e.preventDefault();
          navigate('down');
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          if (showOverlay) {
            // OK while browsing — immediately jump to browsed channel
            clearTimeout(switchTimer.current);
            setActiveIdx(browseIdx);
            setShowOverlay(false);
          }
          break;
        case 'Escape':
        case 'GoBack':
        case 'Back':
        case 'BrowserBack':
          e.preventDefault();
          onClose();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, browseIdx, showOverlay, onClose]);

  // Cleanup timers on unmount
  useEffect(() => () => {
    clearTimeout(switchTimer.current);
    clearTimeout(overlayTimer.current);
  }, []);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const prevCh = playable[browseIdx - 1] ?? null;
  const nextCh = playable[browseIdx + 1] ?? null;
  const hasNav = playable.length > 1;

  return (
    <div className="fixed inset-0 z-[9999] bg-black" data-testid="fullscreen-player">

      {/* ── Video ─────────────────────────────────────────────────────────── */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        poster={posterSrc || undefined}
        data-testid="fullscreen-video"
      />

      {/* ── Channel browse overlay (appears on ↑↓, auto-hides after 3s) ───── */}
      {hasNav && showOverlay && (
        <div
          className="absolute bottom-0 left-0 right-0 px-10 py-8"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.6) 70%, transparent 100%)' }}
          data-testid="channel-browse-overlay"
        >
          <div className="space-y-3 mb-5">
            {prevCh && <ChannelRow ch={prevCh} isBrowsed={false} />}
            <ChannelRow ch={browseChannel} isBrowsed={true} />
            {nextCh && <ChannelRow ch={nextCh} isBrowsed={false} />}
          </div>
          <p className="text-gray-600 text-xs tracking-wide">
            ↑↓ BROWSE &nbsp;·&nbsp; OK TO WATCH &nbsp;·&nbsp; BACK TO EXIT GUIDE
          </p>
        </div>
      )}
    </div>
  );
};

export default FullscreenPlayer;
