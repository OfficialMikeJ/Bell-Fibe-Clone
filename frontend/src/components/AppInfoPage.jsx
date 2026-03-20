import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Tag, Zap, Star, X, CheckCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;
const LS_KEY = 'sv_last_seen_version';

// ── Version Changelog Card (inline + popup) ────────────────────────────────────
export const VersionCard = ({ data, onDismiss, isPopup = false }) => {
  if (!data) return null;
  const { version, sections } = data;

  const card = (
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
          {isPopup && (
            <button
              onClick={onDismiss}
              data-testid="version-popup-dismiss"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
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

      {isPopup && (
        <div className="px-6 pb-5 pt-1">
          <button
            onClick={onDismiss}
            data-testid="version-popup-got-it"
            className="w-full py-3 rounded-xl bg-[#0056A8] hover:bg-[#0066c8] text-white font-semibold text-sm transition-colors"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );

  if (!isPopup) return card;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-16 px-4"
      style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}
      onClick={onDismiss}
    >
      {card}
    </div>
  );
};

// ── Version Popup (auto-shown when version changes) ───────────────────────────
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

  const dismiss = useCallback(() => {
    if (versionData?.version) localStorage.setItem(LS_KEY, versionData.version);
    setShow(false);
  }, [versionData]);

  if (!show || !versionData) return null;
  return <VersionCard data={versionData} onDismiss={dismiss} isPopup />;
};

// ── App Info Page ─────────────────────────────────────────────────────────────
const AppInfoPage = () => {
  const [versionData,     setVersionData]     = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [showPopupPreview, setShowPopupPreview] = useState(false);

  useEffect(() => {
    axios.get(`${API}/api/app-version`)
      .then(r => setVersionData(r.data))
      .catch(() => setVersionData({ version: '0.97.1.3.B (Alpha build)', sections: [] }))
      .finally(() => setLoading(false));
  }, []);

  const replayPopup = () => {
    localStorage.removeItem(LS_KEY);
    setShowPopupPreview(true);
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#1a1a1a' }}>
      {showPopupPreview && versionData && (
        <VersionCard data={versionData} onDismiss={() => setShowPopupPreview(false)} isPopup />
      )}

      <div className="max-w-2xl mx-auto px-8 py-10">
        <div className="mb-8">
          <h1 className="text-white text-3xl font-bold mb-1">App Info</h1>
          <p className="text-gray-500 text-sm">Version details and release notes</p>
        </div>

        {loading ? (
          <div className="text-gray-500 text-sm">Loading...</div>
        ) : (
          <>
            <VersionCard data={versionData} isPopup={false} />
            <div className="mt-6 flex justify-center">
              <button
                onClick={replayPopup}
                data-testid="replay-version-popup-btn"
                className="px-6 py-2.5 rounded-xl bg-[#0056A8] hover:bg-[#0066c8] text-white text-sm font-medium transition-colors"
              >
                What's New
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AppInfoPage;
