import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QrCode, MessageSquare, HelpCircle, Activity, Loader, AlertCircle, Tv } from 'lucide-react';
import { usePortal } from './PortalLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PortalHome() {
  const { session, login, serviceName } = usePortal();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API}/devices/portal-login?activation_code=${encodeURIComponent(code.trim())}`);
      login({ user_id: res.data.user_id, device_name: res.data.device_name, device_id: res.data.device_id });
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid activation code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  const quickLinks = [
    { icon: <HelpCircle className="w-6 h-6" />, label: 'Browse FAQ', desc: 'Find answers to common questions', to: '/portal/faq', color: 'bg-purple-50 text-purple-600' },
    { icon: <MessageSquare className="w-6 h-6" />, label: 'Submit a Ticket', desc: 'Report an issue or request help', to: '/portal/support', color: 'bg-blue-50 text-blue-600', requiresAuth: true },
    { icon: <Activity className="w-6 h-6" />, label: 'Service Status', desc: 'Check if services are running', to: '/portal/status', color: 'bg-green-50 text-green-600' },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      {/* Hero */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold text-gray-900">Welcome to the<br />Support Portal</h1>
        <p className="text-gray-500 text-lg">Get help, check service status, or submit a support ticket.</p>
      </div>

      {!session ? (
        /* Login card */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-[#0056A8] rounded-xl flex items-center justify-center">
              <QrCode className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Sign In with Your QR Code</h2>
              <p className="text-sm text-gray-500">Enter the activation code from your device QR sticker</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Enter your activation code"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8] font-mono"
              data-testid="portal-activation-code-input"
            />
            {error && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0056A8] text-white py-3 rounded-xl font-semibold hover:bg-[#0066c8] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              data-testid="portal-login-btn"
            >
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-4">
            Don't have a code? &nbsp;<a href="/activate" className="text-[#0056A8] font-medium hover:underline">Activate your device</a>
          </p>
        </div>
      ) : (
        /* Logged-in welcome */
        <div className="bg-gradient-to-r from-[#0056A8] to-[#0070d8] rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Tv className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white/80 text-sm">Welcome back</p>
              <h2 className="text-xl font-bold">{session.device_name}</h2>
              <p className="text-white/70 text-xs font-mono">ID: {session.user_id}</p>
            </div>
          </div>
        </div>
      )}

      {/* Quick links */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Quick Links</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {quickLinks.map(link => (
            <button
              key={link.to}
              onClick={() => {
                if (link.requiresAuth && !session) {
                  setError('Please sign in first to submit a support ticket.');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  navigate(link.to);
                }
              }}
              className="bg-white border border-gray-200 rounded-xl p-5 text-left hover:shadow-md hover:border-gray-300 transition-all group"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${link.color}`}>
                {link.icon}
              </div>
              <p className="font-semibold text-gray-900 group-hover:text-[#0056A8]">{link.label}</p>
              <p className="text-sm text-gray-500 mt-0.5">{link.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
