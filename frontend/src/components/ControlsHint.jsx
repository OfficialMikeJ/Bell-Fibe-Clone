/**
 * ControlsHint — small card (bottom-right) showing guide controls.
 * Auto-dismisses after 10 seconds with a countdown bar.
 * Re-triggered any time by firing: window.dispatchEvent(new CustomEvent('sv-show-controls'))
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, Tv } from 'lucide-react';

const TOTAL_SECONDS = 10;

const CONTROLS = [
  {
    section: 'In the Guide',
    items: [
      { key: '↑↓',  label: 'Browse channels'      },
      { key: 'OK',  label: 'Select & watch channel' },
    ],
  },
  {
    section: 'While Watching',
    items: [
      { key: '↑↓',  label: 'Switch channels'    },
      { key: '←',   label: 'Back to guide'       },
    ],
  },
];

const ControlsHint = () => {
  const [visible,  setVisible]  = useState(true);
  const [exiting,  setExiting]  = useState(false);
  const [seconds,  setSeconds]  = useState(TOTAL_SECONDS);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => setVisible(false), 320);
  }, []);

  // Countdown
  useEffect(() => {
    if (!visible || exiting) return;
    if (seconds <= 0) { dismiss(); return; }
    const t = setTimeout(() => setSeconds(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds, visible, exiting, dismiss]);

  // Re-show when custom event fires (from User Settings)
  useEffect(() => {
    const onShow = () => {
      setExiting(false);
      setVisible(true);
      setSeconds(TOTAL_SECONDS);
    };
    window.addEventListener('sv-show-controls', onShow);
    return () => window.removeEventListener('sv-show-controls', onShow);
  }, []);

  if (!visible) return null;

  const progress = (seconds / TOTAL_SECONDS) * 100;

  return (
    <div
      className="fixed bottom-6 right-6 z-[9998] w-60"
      style={{
        animation: exiting
          ? 'hintSlideOut 0.3s ease-in forwards'
          : 'hintSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards',
      }}
      data-testid="controls-hint"
    >
      {/* Card */}
      <div className="rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-blue-400" />
            <span className="text-white text-sm font-semibold tracking-wide">Guide Controls</span>
          </div>
          <button
            onClick={dismiss}
            className="w-6 h-6 rounded-full flex items-center justify-center text-gray-600 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="controls-hint-close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Controls list */}
        <div className="px-4 py-3 space-y-3.5">
          {CONTROLS.map(({ section, items }) => (
            <div key={section}>
              <p className="text-gray-600 text-[9px] font-semibold uppercase tracking-widest mb-2">
                {section}
              </p>
              <div className="space-y-1.5">
                {items.map(({ key, label }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span
                      className="inline-flex items-center justify-center text-white text-[11px] font-mono font-bold rounded-lg flex-shrink-0"
                      style={{
                        minWidth: 32, height: 24, padding: '0 6px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.12)',
                      }}
                    >
                      {key}
                    </span>
                    <span className="text-gray-300 text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Countdown bar */}
        <div className="px-4 pb-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-gray-700 text-[9px] uppercase tracking-wider">Auto-dismiss</span>
            <span className="text-gray-600 text-[10px] font-mono">{seconds}s</span>
          </div>
          <div className="h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'rgba(59,130,246,0.6)',
                transition: 'width 1s linear',
              }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hintSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes hintSlideOut {
          from { opacity: 1; transform: translateY(0)    scale(1);    }
          to   { opacity: 0; transform: translateY(16px) scale(0.95); }
        }
      `}</style>
    </div>
  );
};

export default ControlsHint;
