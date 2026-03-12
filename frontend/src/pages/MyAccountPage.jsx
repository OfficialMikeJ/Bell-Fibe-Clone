import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  Tv, User, Shield, RefreshCw, LogOut, QrCode, Copy, CheckCircle,
  Smartphone, AlertCircle, Loader, ExternalLink,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MyAccountPage() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const token = localStorage.getItem('customer_token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { navigate('/customer-login'); return; }
    fetchCustomer();
  }, []);

  const fetchCustomer = async () => {
    try {
      const res = await axios.get(`${API}/customer/me`, { headers });
      setCustomer(res.data);
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('customer_token');
        localStorage.removeItem('customer_info');
        navigate('/customer-login');
      } else {
        setError('Failed to load account details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPIN = async () => {
    if (!window.confirm('This will generate a new 6-digit PIN. Your old PIN will no longer work. Continue?')) return;
    setRefreshing(true);
    try {
      const res = await axios.post(`${API}/customer/refresh-pin`, {}, { headers });
      setCustomer(prev => ({
        ...prev,
        activation_pin: res.data.activation_pin,
        qr_code_path: res.data.qr_code_path,
        is_activated: false,
      }));
    } catch {
      setError('Failed to refresh PIN. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const copyPIN = () => {
    if (!customer?.activation_pin) return;
    navigator.clipboard.writeText(customer.activation_pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLogout = () => {
    localStorage.removeItem('customer_token');
    localStorage.removeItem('customer_info');
    navigate('/register');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="w-8 h-8 text-[#0056A8] animate-spin" />
      </div>
    );
  }

  if (!customer) return null;

  const pin = customer.activation_pin || '------';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#0056A8] text-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Tv className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold">My Account</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/portal" className="text-white/80 hover:text-white text-sm flex items-center gap-1">
              Support <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button onClick={handleLogout} className="text-white/80 hover:text-white flex items-center gap-1 text-sm">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Welcome */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-[#0056A8] rounded-xl flex items-center justify-center">
                <User className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {customer.first_name} {customer.last_name}
                </h1>
                <p className="text-gray-500 text-sm">{customer.email}</p>
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${
                  customer.status === 'active' ? 'bg-green-100 text-green-700' :
                  customer.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-600'
                }`}>
                  {customer.status === 'active' ? 'Active' :
                   customer.status === 'pending' ? 'Pending Activation' : customer.status}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Device Brand</p>
                <p className="font-medium text-gray-900">{customer.device_brand}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-gray-500 text-xs">Device Type</p>
                <p className="font-medium text-gray-900">{customer.device_type}</p>
              </div>
            </div>
          </div>

          {/* 6-digit PIN — the star of the show */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#0056A8]" />
                <h2 className="text-lg font-bold text-gray-900">Your Activation PIN</h2>
              </div>
              {customer.is_activated && (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 border border-green-200 px-2 py-1 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" /> Activated
                </span>
              )}
            </div>

            {/* Big PIN display */}
            <div className="bg-gradient-to-r from-[#0056A8] to-[#0070d8] rounded-xl p-6 mb-4">
              <p className="text-white/70 text-sm text-center mb-3">Enter this PIN in your device app</p>
              <div className="flex items-center justify-center gap-3 mb-3">
                {pin.split('').map((d, i) => (
                  <div key={i}
                    className="w-12 h-14 bg-white rounded-xl flex items-center justify-center text-[#0056A8] text-2xl font-bold shadow-lg select-all"
                    data-testid={`pin-digit-${i}`}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2">
                <button onClick={copyPIN}
                  className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs transition-colors"
                  data-testid="copy-pin-btn">
                  {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-300" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy PIN'}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4">
              <Smartphone className="w-4 h-4 text-[#0056A8] shrink-0" />
              <p>Open the TV Service app on your device, then go to <strong>Activate Account</strong> and enter the 6 digits above.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleRefreshPIN}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
                data-testid="refresh-pin-btn"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Generating...' : 'Generate New PIN'}
              </button>
              <Link to="/activate"
                className="flex items-center gap-2 px-4 py-2 bg-[#0056A8] text-white rounded-xl text-sm hover:bg-[#0066c8] transition-colors">
                <Tv className="w-4 h-4" />
                Activate Device
              </Link>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* QR code card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <QrCode className="w-5 h-5 text-[#0056A8]" />
              <h2 className="text-base font-bold text-gray-900">Quick Activate via QR</h2>
            </div>
            {customer.qr_code_path ? (
              <div className="text-center">
                <img
                  src={`${BACKEND_URL}/api${customer.qr_code_path}`}
                  alt="Activation QR Code"
                  className="w-40 h-40 mx-auto rounded-xl border border-gray-200"
                  data-testid="customer-qr-code"
                />
                <p className="text-xs text-gray-400 mt-3">
                  Scan with your Android device camera to auto-fill the activation PIN
                </p>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <QrCode className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm">QR code is being generated</p>
              </div>
            )}
          </div>

          {/* Quick links */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <h2 className="text-base font-bold text-gray-900 mb-3">Quick Links</h2>
            {[
              { label: 'Submit Support Ticket', to: '/portal/support', icon: '🎫' },
              { label: 'Browse FAQ', to: '/portal/faq', icon: '❓' },
              { label: 'Service Status', to: '/portal/status', icon: '📡' },
            ].map(link => (
              <Link key={link.to} to={link.to}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-[#0056A8] hover:bg-blue-50 transition-all group text-sm font-medium text-gray-700 hover:text-[#0056A8]">
                <span>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
