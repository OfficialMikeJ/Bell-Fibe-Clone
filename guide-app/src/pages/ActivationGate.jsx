import React, { useState } from 'react';
import axios from 'axios';
import { API_URL, GUIDE_TITLE } from '../config';

const s = {
  screen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100vh', background: 'linear-gradient(135deg, #001f4d 0%, #0056A8 100%)',
    padding: 24,
  },
  card: {
    background: '#161616', border: '1px solid #333', borderRadius: 20,
    padding: 48, maxWidth: 520, width: '100%', textAlign: 'center',
  },
  logo: {
    width: 64, height: 64, background: '#0056A8', borderRadius: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px', fontSize: 28,
  },
  title: { fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#aaa', marginBottom: 28 },
  label: { fontSize: 13, color: '#888', textAlign: 'left', marginBottom: 6, display: 'block' },
  emailInput: {
    width: '100%', background: '#222', border: '2px solid #444',
    borderRadius: 12, fontSize: 15, color: '#fff', padding: '12px 16px',
    outline: 'none', marginBottom: 20, transition: 'border-color 0.2s', boxSizing: 'border-box',
  },
  pinLabel: { fontSize: 13, color: '#888', marginBottom: 10, display: 'block' },
  pinRow: { display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 },
  pinBox: {
    width: 52, height: 64, background: '#222', border: '2px solid #444',
    borderRadius: 12, fontSize: 28, fontWeight: 700, color: '#fff',
    textAlign: 'center', outline: 'none', transition: 'border-color 0.2s',
  },
  pinBoxFocus: { borderColor: '#0056A8' },
  btn: {
    width: '100%', background: '#0056A8', color: '#fff', border: 'none',
    borderRadius: 12, padding: '16px 24px', fontSize: 17, fontWeight: 600,
    cursor: 'pointer', transition: 'background 0.2s',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  error: {
    background: '#2a1515', border: '1px solid #ef4444', borderRadius: 10,
    padding: '12px 16px', color: '#f87171', fontSize: 14, marginBottom: 20,
  },
  lockout: {
    background: '#2a1a0a', border: '1px solid #f97316', borderRadius: 10,
    padding: '16px 20px', color: '#fb923c', fontSize: 14, marginBottom: 20,
  },
  hint: { fontSize: 12, color: '#555', marginTop: 16, lineHeight: 1.6 },
};

export default function ActivationGate({ onActivated, expiredMessage }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutMins, setLockoutMins] = useState(0);
  const [focusedIdx, setFocusedIdx] = useState(null);

  const pinDigits = pin.padEnd(6, ' ').split('').slice(0, 6);

  const handleDigitChange = (i, val) => {
    const clean = val.replace(/\D/g, '');
    const arr = (pin + '      ').slice(0, 6).split('');
    arr[i] = clean.slice(-1) || ' ';
    const newPin = arr.join('').trimEnd().slice(0, 6);
    setPin(newPin);
    if (clean && i < 5) {
      document.getElementById(`sv-pin-${i + 1}`)?.focus();
    }
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      const arr = (pin + '      ').slice(0, 6).split('');
      arr[i] = ' ';
      const newPin = arr.join('').trimEnd().slice(0, 6);
      setPin(newPin);
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
      onActivated({
        user_id: res.data.user_id,
        device_id: res.data.device_id,
        customer_name: res.data.customer_name,
      });
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
    <div style={s.screen}>
      <div style={s.card}>
        <div style={s.logo}>📺</div>
        <h1 style={s.title}>{GUIDE_TITLE}</h1>
        <p style={s.subtitle}>
          Enter your email and the 6-digit code from<br />
          <strong style={{ color: '#60aff0' }}>Google Authenticator</strong> to activate your device
        </p>

        {expiredMessage && (
          <div style={{ ...s.lockout, borderColor: '#facc15', color: '#fde68a', marginBottom: 20 }}>
            {expiredMessage}
          </div>
        )}

        {lockoutMins > 0 && (
          <div style={s.lockout}>
            <strong>Too Many Attempts</strong>
            <br />Please wait <strong>{lockoutMins} minute(s)</strong> before trying again.
          </div>
        )}

        {error && !lockoutMins && (
          <div style={s.error}>{error}</div>
        )}

        {/* Email */}
        <label style={s.label}>Account Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={lockoutMins > 0}
          style={{ ...s.emailInput, ...(email ? { borderColor: '#0056A8' } : {}) }}
          onFocus={e => { e.currentTarget.style.borderColor = '#0056A8'; }}
          onBlur={e => { e.currentTarget.style.borderColor = email ? '#0056A8' : '#444'; }}
        />

        {/* TOTP code */}
        <label style={s.pinLabel}>Google Authenticator Code</label>
        <div style={s.pinRow}>
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
              style={{
                ...s.pinBox,
                ...(focusedIdx === i ? s.pinBoxFocus : {}),
              }}
            />
          ))}
        </div>

        <button
          onClick={handleActivate}
          disabled={!canActivate}
          style={{
            ...s.btn,
            ...(!canActivate ? s.btnDisabled : {}),
          }}
        >
          {loading ? 'Activating...' : 'Activate Device'}
        </button>

        <p style={s.hint}>
          Need to set up Google Authenticator?<br />
          Visit <strong style={{ color: '#60aff0' }}>your account page</strong> and scan the QR code with the Google Authenticator app.
        </p>
      </div>
    </div>
  );
}
