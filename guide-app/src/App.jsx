import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ActivationGate from './pages/ActivationGate';
import TVGuide from './pages/TVGuide';
import VODPage from './pages/VODPage';
import RecordingsPage from './pages/RecordingsPage';
import axios from 'axios';
import { API_URL } from './config';

// Check if device is activated
async function verifyDevice(deviceId) {
  try {
    const res = await axios.get(`${API_URL}/api/devices/guide/${deviceId}`);
    return res.data.authorized;
  } catch {
    return false;
  }
}

function AppShell() {
  const [authState, setAuthState] = useState('loading'); // loading | unactivated | ready
  const [deviceInfo, setDeviceInfo] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem('sv_device');
    if (!stored) {
      setAuthState('unactivated');
      return;
    }
    const device = JSON.parse(stored);
    verifyDevice(device.device_id).then(ok => {
      if (ok) {
        setDeviceInfo(device);
        setAuthState('ready');
      } else {
        localStorage.removeItem('sv_device');
        setAuthState('unactivated');
      }
    });
  }, []);

  const handleActivated = (device) => {
    localStorage.setItem('sv_device', JSON.stringify(device));
    setDeviceInfo(device);
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
