import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Tag, Zap, Star, X, CheckCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const LS_KEY = 'sv_last_seen_version';

// ── Version Changelog Card (popup only) ─────────────────────────────────────
export const VersionCard = ({ data, onDismiss }) => {
  if (!data) return null;
  const { version, sections } = data;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-16 px-4"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.08)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4" style={{ background: '#252525', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Tag className="w-4 h-4 text-[#0056A8]" />
                <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">StreamVault</span>
              </div>
              <h2 className="text-white text-xl font-bold font-mono">{version}</h2>
            </div>
            <button
              onClick={onDismiss}
              data-testid="version-popup-dismiss"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sections */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto space-y-5">
          {sections && sections.length > 0 ? (
            sections.map((section, si) => (
              <div key={si}>
                <h3 className="text-[#0056A8] text-sm font-semibold mb-2 flex items-center gap-2">
                  {si === 0 ? <Zap className="w-4 h-4" /> : si === 1 ? <CheckCircle className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                  {section.heading}
                </h3>
                <ul className="space-y-1.5 pl-2">
                  {section.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2">
                      <span className="mt-1.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#0056A8]" />
                      <span className="text-gray-300 text-sm leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600 text-sm">No changelog entries yet.</p>
              <p className="text-gray-700 text-xs mt-1">Admin can add release notes via the dashboard.</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-5 pt-1">
          <button
            onClick={onDismiss}
            data-testid="version-popup-got-it"
            className="w-full py-3 rounded-xl bg-[#0056A8] hover:bg-[#0066c8] text-white font-semibold text-sm transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Single Version Popup (auto-show on load + manual trigger via custom event) ─
export const VersionPopup = () => {
  const [versionData, setVersionData] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const fetchAndCheck = async () => {
      try {
        const res = await axios.get(`${API}/api/app-version`);
        const data = res.data;
        setVersionData(data);
        if (localStorage.getItem(LS_KEY) !== data.version) setShow(true);
      } catch { /* silently fail */ }
    };
    fetchAndCheck();
  }, []);

  // Listen for manual trigger from App Info page
  useEffect(() => {
    const handleShowVersion = () => setShow(true);
    window.addEventListener('show-version-popup', handleShowVersion);
    return () => window.removeEventListener('show-version-popup', handleShowVersion);
  }, []);

  const dismiss = useCallback(() => {
    if (versionData?.version) localStorage.setItem(LS_KEY, versionData.version);
    setShow(false);
  }, [versionData]);

  if (!show || !versionData) return null;
  return <VersionCard data={versionData} onDismiss={dismiss} />;
};

// ── App Info Page (just a trigger button — uses the shared popup) ─────────────
const AppInfoPage = () => {
  const [versionData, setVersionData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/app-version`)
      .then(r => setVersionData(r.data))
      .catch(() => setVersionData({ version: '—', sections: [] }))
      .finally(() => setLoading(false));
  }, []);

  const showPopup = () => {
    window.dispatchEvent(new CustomEvent('show-version-popup'));
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#1a1a1a' }}>
      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-white text-3xl font-bold mb-1">Version</h1>
          <p className="text-gray-500 text-sm">Current version and release notes</p>
        </div>

        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : (
          <div className="max-w-lg mx-auto text-center">
            <div className="mb-6 p-6 rounded-2xl" style={{ background: '#252525', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 justify-center mb-2">
                <Tag className="w-4 h-4 text-[#0056A8]" />
                <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">StreamVault</span>
              </div>
              <h2 className="text-white text-2xl font-bold font-mono mb-1" data-testid="version-display">
                {versionData?.version || '—'}
              </h2>
              <p className="text-gray-500 text-xs">
                {versionData?.sections?.length
                  ? `${versionData.sections.reduce((sum, s) => sum + s.items.length, 0)} changes in this release`
                  : 'No release notes available'}
              </p>
            </div>
            <button
              onClick={showPopup}
              data-testid="replay-version-popup-btn"
              className="px-8 py-3 rounded-xl bg-[#0056A8] hover:bg-[#0066c8] text-white text-sm font-medium transition-colors"
            >
              View Release Notes
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppInfoPage;
