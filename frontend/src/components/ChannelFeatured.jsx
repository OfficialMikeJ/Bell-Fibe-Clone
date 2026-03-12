import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Radio } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ChannelFeatured = ({ channel, currentProgram }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoSrc = currentProgram?.media_file_path
    ? `${BACKEND_URL}${currentProgram.media_file_path}`
    : channel?.stream_url || null;

  const posterSrc = currentProgram?.poster_path
    ? `${BACKEND_URL}${currentProgram.poster_path}`
    : null;

  useEffect(() => {
    setIsPlaying(false);
    setHasError(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [channel?.id, currentProgram?.id]);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play().catch(() => setHasError(true));
    }
    setIsPlaying(!isPlaying);
  };

  const handleMute = () => {
    if (videoRef.current) videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) videoRef.current.requestFullscreen();
    }
  };

  if (!channel) return null;

  const logoSrc = channel.logo_path
    ? (channel.logo_path.startsWith('http') ? channel.logo_path : `${BACKEND_URL}${channel.logo_path}`)
    : null;

  return (
    <div className="mb-6">
      <div className="flex items-start gap-4">
        {/* Video Preview / Poster Card */}
        <div className="w-52 h-36 bg-[#0a0a0a] rounded-xl overflow-hidden relative flex-shrink-0 group shadow-2xl border border-gray-700">
          {videoSrc && !hasError ? (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                src={videoSrc}
                poster={posterSrc || undefined}
                muted={isMuted}
                loop
                playsInline
                onError={() => setHasError(true)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              {/* Video Controls Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                  <button onClick={handlePlayPause}
                    className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors">
                    {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                  </button>
                  <button onClick={handleMute}
                    className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors">
                    {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                  </button>
                  <button onClick={handleFullscreen}
                    className="w-8 h-8 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors">
                    <Maximize2 className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
              {/* LIVE badge if stream */}
              {channel.stream_url && (
                <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  LIVE
                </div>
              )}
            </>
          ) : posterSrc ? (
            <div className="relative w-full h-full">
              <img src={posterSrc} alt={currentProgram?.title || channel.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <Radio className="w-8 h-8 text-white opacity-60" />
              </div>
            </div>
          ) : logoSrc ? (
            <div className="w-full h-full bg-gradient-to-br from-[#0056A8] to-[#003d7a] flex items-center justify-center p-4">
              <img src={logoSrc} alt={channel.name} className="w-full h-full object-contain"
                onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0056A8] to-[#003d7a] flex items-center justify-center">
              <div className="text-center">
                <div className="text-white text-3xl font-bold">{channel.number}</div>
                <div className="text-blue-200 text-xs mt-1">{channel.name}</div>
              </div>
            </div>
          )}
        </div>

        {/* Channel & Program Info */}
        <div className="flex-1 pt-1 min-w-0">
          <h2 className="text-4xl font-light text-white mb-1 truncate">{channel.name}</h2>
          <p className="text-base text-gray-400 mb-2">
            {channel.number} • {channel.quality_label || 'HD'}
            {channel.channel_type === 'vod' && <span className="ml-2 px-2 py-0.5 bg-purple-700 text-white text-xs rounded">VOD</span>}
          </p>
          {currentProgram ? (
            <div>
              <p className="text-lg text-white font-medium truncate">{currentProgram.title}</p>
              <p className="text-sm text-gray-300 mt-1 line-clamp-2 leading-relaxed">{currentProgram.description || channel.description}</p>
              {currentProgram.duration_formatted && (
                <p className="text-xs text-gray-500 mt-1">Duration: {currentProgram.duration_formatted}</p>
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
