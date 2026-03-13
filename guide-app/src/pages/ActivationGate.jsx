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
  subtitle: { fontSize: 16, color: '#aaa', marginBottom: 36 },
  pinRow: { display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 24 },
  pinBox: {
    width: 56, height: 68, background: '#222', border: '2px solid #444',
    borderRadius: 12, fontSize: 32, fontWeight: 700, color: '#fff',
    textAlign: 'center', outline: 'none', transition: 'border-color 0.2s',
  },
  pinBoxFocus: { borderColor: '#0056A8' },
  btn: {
    width: '100%', background: '#0056A8', color: '#fff', border: 'none',
    borderRadius: 12, padding: '16px 24px', fontSize: 18, fontWeight: 600,
    cursor: 'pointer', transition: 'background 0.2s',
  },
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  error: {
    background: '#2a1515', border: '1px solid #ef4444', borderRadius: 10,
    padding: '12px 16px', color: '#f87171', fontSize: 15, marginBottom: 20,
  },
  lockout: {
    background: '#2a1a0a', border: '1px solid #f97316', borderRadius: 10,
    padding: '16px 20px', color: '#fb923c', fontSize: 15, marginBottom: 20,
  },
};

export default function ActivationGate({ onActivated }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutMins, setLockoutMins] = useState(0);
  const [focusedIdx, setFocusedIdx] = useState(0);

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
    } else if (e.key === 'Enter' && pin.trim().length === 6) {
      handleActivate();
    }
  };

  const handleActivate = async () => {
    const trimPin = pin.trim();
    if (trimPin.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_URL}/api/customer/activate-with-pin?pin=${trimPin}`);
      onActivated({
        user_id: res.data.user_id,
        device_id: res.data.device_id,
        customer_name: res.data.customer_name,
      });
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || 'Activation failed.';
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
          Enter the 6-digit activation PIN from your account at
          <br /><strong style={{ color: '#60aff0' }}>tv.streamvault.ca/my-account</strong>
        </p>

        {lockoutMins > 0 ? (
          <div style={s.lockout}>
            <strong>Account Locked</strong>
            <br />Too many failed attempts. Please wait <strong>{lockoutMins} minute(s)</strong> before trying again.
          </div>
        ) : null}

        {error && !lockoutMins ? (
          <div style={s.error}>{error}</div>
        ) : null}

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
          disabled={pin.trim().length !== 6 || loading || lockoutMins > 0}
          style={{
            ...s.btn,
            ...(pin.trim().length !== 6 || loading || lockoutMins > 0 ? s.btnDisabled : {}),
          }}
        >
          {loading ? 'Activating...' : 'Activate Device'}
        </button>
      </div>
    </div>
  );
}
