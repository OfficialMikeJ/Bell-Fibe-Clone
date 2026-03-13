import React, { useEffect, useState } from 'react';

const DISPLAY_MS = 5500;

/**
 * Centered on-screen notification shown after an auto-refresh.
 * Fades in, shows a countdown progress bar, then fades out.
 */
export default function RefreshNotification({ visible, onDone }) {
  const [phase, setPhase] = useState('hidden'); // hidden | enter | show | exit

  useEffect(() => {
    if (!visible) return;

    setPhase('enter');

    const enterTimer = setTimeout(() => setPhase('show'), 50);
    const exitTimer  = setTimeout(() => setPhase('exit'),  DISPLAY_MS);
    const doneTimer  = setTimeout(() => { setPhase('hidden'); onDone?.(); }, DISPLAY_MS + 500);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [visible, onDone]);

  if (phase === 'hidden') return null;

  const isVisible = phase === 'show' || phase === 'enter';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(10, 14, 26, 0.92)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(0, 86, 168, 0.5)',
          borderRadius: 20,
          padding: '28px 36px',
          maxWidth: 480,
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 0 60px rgba(0,86,168,0.25), 0 24px 64px rgba(0,0,0,0.6)',
          transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
          opacity: phase === 'exit' ? 0 : isVisible ? 1 : 0,
          transition: phase === 'exit'
            ? 'opacity 0.45s ease, transform 0.45s ease'
            : 'opacity 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 52, height: 52,
            background: 'linear-gradient(135deg, #0056A8, #0080ff)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: 24,
            boxShadow: '0 4px 20px rgba(0,86,168,0.4)',
          }}
        >
          ✓
        </div>

        {/* Title */}
        <p style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 8, lineHeight: 1.4 }}>
          Guide Auto-Refreshed
        </p>

        {/* Body */}
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.65, marginBottom: 20 }}>
          New content has been added and your guide has been<br />
          auto-refreshed for your convenience.
        </p>

        {/* Blue close button */}
        <button
          onClick={() => { setPhase('exit'); setTimeout(() => { setPhase('hidden'); onDone?.(); }, 450); }}
          style={{
            display: 'block',
            width: '100%',
            background: 'linear-gradient(135deg, #0056A8, #0080ff)',
            border: 'none',
            borderRadius: 10,
            padding: '10px 0',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'opacity 0.15s, transform 0.15s',
            pointerEvents: 'auto',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.01)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          Close
        </button>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #0056A8, #0080ff)',
              borderRadius: 99,
              transformOrigin: 'left',
              animation: phase !== 'hidden' ? `sv-progress ${DISPLAY_MS}ms linear forwards` : 'none',
            }}
          />
        </div>

        <style>{`
          @keyframes sv-progress {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
          }
        `}</style>
      </div>
    </div>
  );
}
