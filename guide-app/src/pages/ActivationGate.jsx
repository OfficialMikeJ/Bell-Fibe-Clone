import React, { useState } from 'react';
import axios from 'axios';
import { API_URL, GUIDE_TITLE } from '../config';

export default function ActivationGate({ onActivated, expiredMessage }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutMins, setLockoutMins] = useState(0);
  const [focusedIdx, setFocusedIdx] = useState(null);
  const [success, setSuccess] = useState(false);

  const pinDigits = (pin + '      ').slice(0, 6).split('');

  const handleDigitChange = (i, val) => {
    const clean = val.replace(/\D/g, '');
    const arr = (pin + '      ').slice(0, 6).split('');
    arr[i] = clean.slice(-1) || ' ';
    const newPin = arr.join('').trimEnd().slice(0, 6);
    setPin(newPin);
    if (clean && i < 5) document.getElementById(`sv-pin-${i + 1}`)?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      const arr = (pin + '      ').slice(0, 6).split('');
      arr[i] = ' ';
      setPin(arr.join('').trimEnd().slice(0, 6));
      if (i > 0) document.getElementById(`sv-pin-${i - 1}`)?.focus();
    } else if (e.key === 'Enter' && canActivate) {
      handleActivate();
    }
  };

  const canActivate = email.includes('@') && pin.trim().length === 6 && !loading && !lockoutMins;

  const handleActivate = async () => {
    if (!canActivate) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/api/customer/activate-with-totp`, {
        email: email.trim().toLowerCase(),
        totp_code: pin.trim(),
      });
      setSuccess(true);
      setTimeout(() => {
        onActivated({
          user_id: res.data.user_id,
          device_id: res.data.device_id,
          customer_name: res.data.customer_name,
        });
      }, 900);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || 'Activation failed. Please try again.';
      if (status === 429) {
        const match = detail.match(/(\d+) minute/);
        setLockoutMins(match ? parseInt(match[1]) : 45);
      } else {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      style={{ background: '#070710' }}
    >
      {/* ── Cinematic background layers ───────────────────────────────── */}
      <div
        className="absolute inset-0 sv-bg-breathe"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,56,168,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 50% 40% at 50% 100%, rgba(0,86,168,0.12) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />
      {/* Subtle grid texture */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      {/* ── Card ──────────────────────────────────────────────────────── */}
      <div
        className={`relative z-10 w-full max-w-md mx-4 sv-slide-up sv-d-0 ${success ? 'opacity-0 scale-95 transition-all duration-700' : ''}`}
        style={{
          background: 'rgba(16, 16, 26, 0.85)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '24px',
          padding: '48px 40px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
          transition: 'opacity 0.7s ease, transform 0.7s ease',
        }}
      >
        {/* ── Logo ─────────────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div
            className="sv-scale-bounce sv-d-1 sv-glow-pulse inline-flex items-center justify-center mb-5"
            style={{
              width: 72, height: 72,
              background: 'linear-gradient(135deg, #0056A8 0%, #0080ff 100%)',
              borderRadius: 20,
              fontSize: 32,
              boxShadow: '0 8px 32px rgba(0,86,168,0.4)',
            }}
          >
            📺
          </div>

          <h1
            className="sv-slide-up sv-d-2 text-white font-bold tracking-tight"
            style={{ fontSize: 28, marginBottom: 6 }}
          >
            {GUIDE_TITLE}
          </h1>
          <p className="sv-slide-up sv-d-3" style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, lineHeight: 1.6 }}>
            Sign in with your email and{' '}
            <span style={{ color: '#60a5fa', fontWeight: 500 }}>Google Authenticator</span>
            <br />to activate this device
          </p>
        </div>

        {/* ── Expired / lockout banners ─────────────────────────────── */}
        {expiredMessage && !lockoutMins && (
          <div
            className="sv-slide-up sv-d-3 mb-5 flex items-start gap-3"
            style={{
              background: 'rgba(250, 204, 21, 0.08)',
              border: '1px solid rgba(250,204,21,0.25)',
              borderRadius: 12, padding: '12px 14px',
              color: '#fde68a', fontSize: 13, lineHeight: 1.5,
            }}
          >
            <span style={{ fontSize: 16, marginTop: 1 }}>⏱</span>
            {expiredMessage}
          </div>
        )}

        {lockoutMins > 0 && (
          <div
            className="sv-slide-up mb-5 flex items-start gap-3"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12, padding: '12px 14px',
              color: '#fca5a5', fontSize: 13, lineHeight: 1.5,
            }}
          >
            <span style={{ fontSize: 16, marginTop: 1 }}>🔒</span>
            <div>
              <strong>Too many attempts</strong>
              <br />Please wait <strong>{lockoutMins} minute(s)</strong> before trying again.
            </div>
          </div>
        )}

        {error && !lockoutMins && (
          <div
            className="sv-slide-up mb-5 flex items-center gap-2"
            style={{
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 12, padding: '12px 14px',
              color: '#fca5a5', fontSize: 13,
            }}
          >
            <span>⚠</span> {error}
          </div>
        )}

        {/* ── Email field ───────────────────────────────────────────── */}
        <div className="sv-slide-up sv-d-4 mb-5">
          <label
            htmlFor="sv-email"
            style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}
          >
            Account Email
          </label>
          <input
            id="sv-email"
            type="email"
            className="sv-email-input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            disabled={lockoutMins > 0}
            autoComplete="email"
          />
        </div>

        {/* ── TOTP code ─────────────────────────────────────────────── */}
        <div className="sv-slide-up sv-d-5 mb-7">
          <label
            style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}
          >
            Authenticator Code
          </label>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <input
                key={i}
                id={`sv-pin-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={pinDigits[i].trim()}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                onFocus={() => setFocusedIdx(i)}
                onBlur={() => setFocusedIdx(null)}
                disabled={lockoutMins > 0}
                className={`sv-pin-box${pinDigits[i].trim() ? ' filled' : ''}`}
                style={{ ...(focusedIdx === i ? { borderColor: '#0056A8', background: 'rgba(0,86,168,0.15)', transform: 'scale(1.08)', boxShadow: '0 0 0 3px rgba(0,86,168,0.25)' } : {}) }}
              />
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8 }}>
            6-digit code from Google Authenticator
          </p>
        </div>

        {/* ── Activate button ───────────────────────────────────────── */}
        <div className="sv-slide-up sv-d-6">
          <button
            onClick={handleActivate}
            disabled={!canActivate}
            className="sv-activate-btn"
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                Activating...
              </span>
            ) : success ? '✓ Activated!' : 'Activate Device'}
          </button>
        </div>

        {/* ── Hint ──────────────────────────────────────────────────── */}
        <p className="sv-fade-in sv-d-7" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 20, lineHeight: 1.7 }}>
          New to StreamVault? Visit your account page and<br />scan the QR code with Google Authenticator first.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
