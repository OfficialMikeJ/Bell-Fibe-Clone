import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import ActivationGate from './pages/ActivationGate';
import TVGuide from './pages/TVGuide';
import axios from 'axios';
import { API_URL } from './config';

const INACTIVITY_DAYS = 45;
const DEVICE_KEY = 'sv_device';

function isDeviceExpired(device) {
  const lastActive = device.last_active ? new Date(device.last_active) : null;
  if (!lastActive) return true;
  const daysSince = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > INACTIVITY_DAYS;
}

async function verifyDevice(deviceId) {
  try {
    const res = await axios.get(`${API_URL}/api/devices/guide/${deviceId}`);
    // Success (200) means the device is valid and authorized
    return res.status === 200;
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

    // Verify device is still active on server
    verifyDevice(device.device_id).then(ok => {
      if (ok) {
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
        expiredMessage="Your session has expired after 45 days of inactivity. Please re-enter your username and password to continue."
      />
    );
  }

  return <TVGuide deviceInfo={deviceInfo} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
