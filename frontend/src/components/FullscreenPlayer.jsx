/**
 * FullscreenPlayer — pure video, zero UI.
 * Click channel or press OK → this opens immediately.
 * Press ESC / Android back button → exits.
 */
import React, { useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const isHLS = (url) => url && (
  url.includes('.m3u8') || url.includes('/hls/') || url.includes('playlist')
);

const getStoredVolume = () => {
  try {
    const v = localStorage.getItem('sv_volume_preference');
    if (v !== null) { const n = parseFloat(v); if (!isNaN(n) && n >= 0 && n <= 1) return n; }
  } catch { /**/ }
  return 0.3;
};

const FullscreenPlayer = ({ channel, currentProgram, onClose }) => {
  const videoRef = useRef(null);
  const hlsRef   = useRef(null);
  const retryRef = useRef(null);

  const videoSrc = currentProgram?.media_file_path
    ? `${BACKEND_URL}/api${currentProgram.media_file_path}`   // Scheduled program file
    : channel?.media_file_path
    ? `${BACKEND_URL}/api${channel.media_file_path}`          // Channel's directly linked file
    : channel?.stream_url || null;                            // Fallback (future HLS use)

  const posterSrc = currentProgram?.poster_path
    ? `${BACKEND_URL}/api${currentProgram.poster_path}`
    : null;

  const destroyHls = useCallback(() => {
    if (hlsRef.current)  { hlsRef.current.destroy(); hlsRef.current = null; }
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }
  }, []);

  // Start stream
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;

    destroyHls();
    video.volume = getStoredVolume();

    if (isHLS(videoSrc)) {
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30 });
        hlsRef.current = hls;
        hls.loadSource(videoSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal && data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            retryRef.current = setTimeout(() => hlsRef.current?.startLoad(), 5000);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = videoSrc;
        video.addEventListener('loadedmetadata', () => video.play().catch(() => {}), { once: true });
      }
    } else {
      video.src = videoSrc;
      video.load();
      video.addEventListener('canplay',  () => video.play().catch(() => {}), { once: true });
      video.addEventListener('error',    () => {}, { once: true });
    }

    return destroyHls;
  }, [videoSrc, destroyHls]);

  // ESC / Android back button closes player
  useEffect(() => {
    const onKey = (e) => {
      if (['Escape', 'GoBack', 'Back', 'BrowserBack'].includes(e.key)) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Prevent scroll behind the player
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-black" data-testid="fullscreen-player">
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        poster={posterSrc || undefined}
        data-testid="fullscreen-video"
      />
    </div>
  );
};

export default FullscreenPlayer;
