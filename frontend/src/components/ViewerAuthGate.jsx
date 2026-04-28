import React, { useState } from 'react';
import axios from 'axios';
import { Tv, Loader2, Lock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ViewerAuthGate = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(() => {
    const session = localStorage.getItem('sv_viewer_session');
    if (!session) return false;
    try {
      const data = JSON.parse(session);
      // Check if session is still valid (45 days)
      const expiry = new Date(data.authenticated_at).getTime() + (45 * 24 * 60 * 60 * 1000);
      return Date.now() < expiry;
    } catch {
      return false;
    }
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/customer/activate-with-credentials`, {
        app_username: username,
        app_password: password,
        device_name: navigator.userAgent.includes('Android') ? 'Android Device' : 'Web Browser',
        device_uuid: localStorage.getItem('sv_device_uuid') || crypto.randomUUID(),
      });
      // Store session
      localStorage.setItem('sv_viewer_session', JSON.stringify({
        user_id: res.data.user_id,
        device_id: res.data.device_id,
        customer_name: res.data.customer_name,
        authenticated_at: new Date().toISOString(),
      }));
      localStorage.setItem('sv_device_uuid', res.data.device_id || crypto.randomUUID());
      setAuthenticated(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  if (authenticated) {
    return children;
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#0056A8] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Tv className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white" data-testid="viewer-auth-title">StreamVault</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to access the TV Guide</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="bg-red-900/20 border border-red-900 text-red-400 text-sm rounded-lg px-4 py-3" data-testid="viewer-auth-error">
              {error}
            </div>
          )}

          <div>
            <label className="text-gray-400 text-xs block mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoComplete="username"
              data-testid="viewer-username-input"
              className="w-full bg-[#2a2a2a] border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:border-[#0056A8] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-gray-400 text-xs block mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              data-testid="viewer-password-input"
              className="w-full bg-[#2a2a2a] border border-gray-700 text-white rounded-lg px-4 py-3 text-sm focus:border-[#0056A8] focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !username || !password}
            data-testid="viewer-login-btn"
            className="w-full bg-[#0056A8] hover:bg-[#0066c8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
            ) : (
              <><Lock className="w-4 h-4" /> Sign In</>
            )}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">
          Contact your provider for account credentials
        </p>
      </div>
    </div>
  );
};

export default ViewerAuthGate;
