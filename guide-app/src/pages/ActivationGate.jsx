import React, { useState } from 'react';
import axios from 'axios';
import { API_URL, GUIDE_TITLE } from '../config';

export default function ActivationGate({ onActivated, expiredMessage }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutMins, setLockoutMins] = useState(0);
  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const canActivate = username.trim().length >= 4 && password.length >= 1 && !loading && !lockoutMins;

  const handleActivate = async () => {
    if (!canActivate) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/api/customer/activate-with-credentials`, {
        app_username: username.trim().toLowerCase(),
        app_password: password,
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
        setLockoutMins(match ? parseInt(match[1]) : LOGIN_LOCKOUT_MINUTES);
      } else {
        setError(detail);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && canActivate) handleActivate();
  };

  const LOGIN_LOCKOUT_MINUTES = 45;

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
        {/* Logo */}
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
            Enter your account credentials<br />to activate this device
          </p>
        </div>

        {/* Expired / lockout banners */}
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
            <span style={{ fontSize: 16, marginTop: 1 }}>&#9203;</span>
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
            <span style={{ fontSize: 16, marginTop: 1 }}>&#128274;</span>
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
            <span>&#9888;</span> {error}
          </div>
        )}

        {/* Username field */}
        <div className="sv-slide-up sv-d-4 mb-5">
          <label
            htmlFor="sv-username"
            style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}
          >
            Username
          </label>
          <input
            id="sv-username"
            type="text"
            className="sv-email-input"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="your username"
            disabled={lockoutMins > 0}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            data-testid="sv-username-input"
          />
        </div>

        {/* Password field */}
        <div className="sv-slide-up sv-d-5 mb-7" style={{ position: 'relative' }}>
          <label
            htmlFor="sv-password"
            style={{ display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}
          >
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="sv-password"
              type={showPass ? 'text' : 'password'}
              className="sv-email-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="your password"
              disabled={lockoutMins > 0}
              autoComplete="current-password"
              data-testid="sv-password-input"
              style={{ paddingRight: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              style={{
                position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)', fontSize: 13, padding: 0,
              }}
              tabIndex={-1}
            >
              {showPass ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Activate button */}
        <div className="sv-slide-up sv-d-6">
          <button
            onClick={handleActivate}
            disabled={!canActivate}
            className="sv-activate-btn"
            data-testid="sv-activate-btn"
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                Activating...
              </span>
            ) : success ? '✓ Activated!' : 'Activate Device'}
          </button>
        </div>

        <p className="sv-fade-in sv-d-7" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 20, lineHeight: 1.7 }}>
          Credentials are provided by your service provider.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
