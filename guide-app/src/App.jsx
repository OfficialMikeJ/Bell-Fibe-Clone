import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ActivationGate from './pages/ActivationGate';
import TVGuide from './pages/TVGuide';
import VODPage from './pages/VODPage';
import RecordingsPage from './pages/RecordingsPage';
import axios from 'axios';
import { API_URL } from './config';

const INACTIVITY_DAYS = 45;
const DEVICE_KEY = 'sv_device';

function isDeviceExpired(device) {
  const lastActive = device.last_active ? new Date(device.last_active) : null;
  if (!lastActive) return true; // no record → treat as expired
  const daysSince = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > INACTIVITY_DAYS;
}

async function verifyDevice(deviceId) {
  try {
    const res = await axios.get(`${API_URL}/api/devices/guide/${deviceId}`);
    return res.data.authorized;
  } catch {
    return false;
  }
}

function AppShell() {
  const [authState, setAuthState] = useState('loading'); // loading | unactivated | expired | ready
  const [deviceInfo, setDeviceInfo] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem(DEVICE_KEY);
    if (!stored) {
      setAuthState('unactivated');
      return;
    }

    const device = JSON.parse(stored);

    // 45-day inactivity check (client-side fast path)
    if (isDeviceExpired(device)) {
      localStorage.removeItem(DEVICE_KEY);
      setAuthState('expired');
      return;
    }

    // Verify with server that device is still active
    verifyDevice(device.device_id).then(ok => {
      if (ok) {
        // Refresh last_active timestamp
        device.last_active = new Date().toISOString();
        localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
        setDeviceInfo(device);
        setAuthState('ready');
      } else {
        localStorage.removeItem(DEVICE_KEY);
        setAuthState('unactivated');
      }
    });
  }, []);

  const handleActivated = (device) => {
    const enriched = { ...device, last_active: new Date().toISOString() };
    localStorage.setItem(DEVICE_KEY, JSON.stringify(enriched));
    setDeviceInfo(enriched);
    setAuthState('ready');
  };

  if (authState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0a' }}>
        <div style={{ textAlign: 'center', color: '#aaa' }}>
          <div style={{ width: 40, height: 40, border: '3px solid #0056A8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
          <p>Loading StreamVault TV...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (authState === 'unactivated') {
    return <ActivationGate onActivated={handleActivated} />;
  }

  if (authState === 'expired') {
    return (
      <ActivationGate
        onActivated={handleActivated}
        expiredMessage="Your session has expired after 45 days of inactivity. Please re-authenticate with Google Authenticator."
      />
    );
  }

  return (
    <Routes>
      <Route path="/" element={<TVGuide deviceInfo={deviceInfo} />} />
      <Route path="/vod" element={<VODPage />} />
      <Route path="/recordings" element={<RecordingsPage deviceInfo={deviceInfo} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
