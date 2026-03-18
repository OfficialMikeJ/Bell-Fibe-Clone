import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Volume1, Play, Pause, Monitor, Sun, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';

const SETTINGS_KEY_VOLUME  = 'sv_volume_preference';
const SETTINGS_KEY_AUTOPLAY = 'sv_autoplay_enabled';
const SETTINGS_KEY_QUALITY  = 'sv_quality_preference';

const getStored = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    if (typeof fallback === 'boolean') return v === 'true';
    if (typeof fallback === 'number') { const n = parseFloat(v); return isNaN(n) ? fallback : n; }
    return v;
  } catch { return fallback; }
};
const setStored = (key, val) => {
  try { localStorage.setItem(key, String(val)); } catch { /* ignore */ }
};

const UserSettingsPage = () => {
  const [volume,   setVolume]   = useState(() => getStored(SETTINGS_KEY_VOLUME, 0.3));
  const [autoplay, setAutoplay] = useState(() => getStored(SETTINGS_KEY_AUTOPLAY, true));
  const [quality,  setQuality]  = useState(() => getStored(SETTINGS_KEY_QUALITY, 'auto'));
  const [saved,    setSaved]    = useState(false);

  const handleSave = () => {
    setStored(SETTINGS_KEY_VOLUME,   volume);
    setStored(SETTINGS_KEY_AUTOPLAY, autoplay);
    setStored(SETTINGS_KEY_QUALITY,  quality);
    setSaved(true);
    toast.success('Settings saved');
    setTimeout(() => setSaved(false), 2000);
  };

  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#0d0820' }}>
      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-white text-3xl font-bold mb-1">User Settings</h1>
          <p className="text-purple-300/60 text-sm">Personalise your StreamVault experience</p>
        </div>

        {/* Volume */}
        <Card className="mb-5 border-purple-900/40" style={{ background: '#1a0e30' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <VolumeIcon className="w-5 h-5 text-purple-400" />
              Preview Volume
            </CardTitle>
            <p className="text-purple-300/60 text-xs">Sets the default volume for the HLS channel preview player</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <VolumeX className="w-4 h-4 text-purple-400/50 flex-shrink-0" />
              <input
                type="range" min="0" max="1" step="0.05"
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                className="flex-1 accent-purple-500 cursor-pointer"
                data-testid="settings-volume-slider"
                style={{ accentColor: '#8b5cf6' }}
              />
              <Volume2 className="w-4 h-4 text-purple-400/50 flex-shrink-0" />
              <span className="text-white text-sm font-mono w-12 text-right" data-testid="settings-volume-value">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <div className="flex justify-between text-purple-400/40 text-xs mt-1 px-5">
              <span>Silent</span>
              <span>Comfortable (30%)</span>
              <span>Full</span>
            </div>
          </CardContent>
        </Card>

        {/* Auto-play */}
        <Card className="mb-5 border-purple-900/40" style={{ background: '#1a0e30' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              {autoplay ? <Play className="w-5 h-5 text-purple-400" /> : <Pause className="w-5 h-5 text-purple-400" />}
              Auto-play Preview
            </CardTitle>
            <p className="text-purple-300/60 text-xs">Automatically start the HLS video preview when switching channels</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm">{autoplay ? 'Enabled — preview starts automatically' : 'Disabled — press play to start preview'}</p>
              </div>
              <button
                onClick={() => setAutoplay(a => !a)}
                data-testid="settings-autoplay-toggle"
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                  autoplay ? 'bg-purple-600' : 'bg-gray-700'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
                  autoplay ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Quality Preference */}
        <Card className="mb-8 border-purple-900/40" style={{ background: '#1a0e30' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Monitor className="w-5 h-5 text-purple-400" />
              Preferred Quality
            </CardTitle>
            <p className="text-purple-300/60 text-xs">Hint for adaptive streaming quality selection</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {['auto', 'high', 'low'].map(q => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  data-testid={`settings-quality-${q}`}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                    quality === q
                      ? 'bg-purple-600 text-white'
                      : 'text-purple-300/60 border border-purple-900/40 hover:border-purple-600/50'
                  }`}
                  style={quality !== q ? { background: '#0d0820' } : {}}
                >
                  {q === 'auto' ? 'Auto (Recommended)' : q === 'high' ? 'High (HD)' : 'Low (Data Saver)'}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <div className="flex items-start gap-2 mb-8 px-1">
          <Info className="w-4 h-4 text-purple-400/40 flex-shrink-0 mt-0.5" />
          <p className="text-purple-300/40 text-xs leading-relaxed">
            Settings are saved to this device only. They will reset if you clear your browser data.
          </p>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          data-testid="settings-save-btn"
          className={`w-full py-3 rounded-xl text-white font-semibold text-base transition-all duration-200 ${
            saved ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-500'
          }`}
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default UserSettingsPage;
