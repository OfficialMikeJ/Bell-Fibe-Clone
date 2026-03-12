import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Tv, CheckCircle, Loader, AlertCircle, Eye, EyeOff, Monitor, Smartphone, Tablet, Box } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const DEVICE_BRANDS = ['Samsung', 'LG', 'TCL', 'Sony', 'Hisense', 'OnePlus', 'Motorola', 'Xiaomi', 'Philips', 'Other'];
const DEVICE_TYPES = [
  { value: 'Android Smart TV', icon: <Monitor className="w-5 h-5" /> },
  { value: 'Android Box', icon: <Box className="w-5 h-5" /> },
  { value: 'Android Tablet', icon: <Tablet className="w-5 h-5" /> },
  { value: 'Android Phone', icon: <Smartphone className="w-5 h-5" /> },
  { value: 'Other/Not Listed', icon: <Tv className="w-5 h-5" /> },
];

const FEATURES = [
  { title: 'Live TV Guide', desc: 'Browse your full channel lineup with a real-time program guide' },
  { title: 'Video On Demand', desc: 'Access movies and shows whenever you want' },
  { title: 'Cloud Recordings', desc: 'Record your favourite programs and watch them later' },
  { title: '4K Quality', desc: 'Up to 4K60 HDR picture quality on supported devices' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('landing'); // landing | form | success
  const [showPass, setShowPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [customerData, setCustomerData] = useState(null);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', password: '',
    device_brand: '', device_type: '', accepted_disclaimer: false,
  });

  const updateForm = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.accepted_disclaimer) {
      setError('Please acknowledge the device compatibility notice to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/customer/register`, {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        device_brand: form.device_brand,
        device_type: form.device_type,
      });
      // Store token in localStorage
      localStorage.setItem('customer_token', res.data.access_token);
      localStorage.setItem('customer_info', JSON.stringify(res.data.customer));
      setCustomerData(res.data.customer);
      setStep('success');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'success' && customerData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#001f4d] to-[#0056A8] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center space-y-6">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {customerData.first_name}!</h1>
            <p className="text-gray-500 mt-1 text-sm">Your account has been created successfully.</p>
          </div>

          {/* 6-digit PIN preview */}
          <div className="bg-[#0056A8] rounded-xl p-5 text-white">
            <p className="text-white/80 text-sm mb-3">Your Activation PIN</p>
            <div className="flex items-center justify-center gap-2">
              {customerData.activation_pin.split('').map((d, i) => (
                <div key={i} className="w-10 h-12 bg-white rounded-lg flex items-center justify-center text-[#0056A8] text-2xl font-bold shadow-inner">
                  {d}
                </div>
              ))}
            </div>
            <p className="text-white/70 text-xs mt-3">Enter this PIN in your device app to activate</p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/my-account')}
              className="w-full bg-[#0056A8] text-white py-3 rounded-xl font-semibold hover:bg-[#0066c8] transition-colors"
            >
              Go to My Account
            </button>
            <p className="text-xs text-gray-400">Your full PIN and QR code are available in My Account</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'form') {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-[#0056A8] text-white py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tv className="w-6 h-6" />
            <span className="font-bold text-lg">TV Service</span>
          </div>
          <button onClick={() => setStep('landing')} className="text-white/80 hover:text-white text-sm">
            ← Back
          </button>
        </header>

        <div className="max-w-xl mx-auto py-10 px-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Account</h1>
          <p className="text-gray-500 mb-8">Fill in your details to get your activation PIN</p>

          <form onSubmit={handleRegister} className="space-y-5">
            {/* Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input required value={form.first_name} onChange={e => updateForm('first_name', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8]"
                  placeholder="John" data-testid="first-name-input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input required value={form.last_name} onChange={e => updateForm('last_name', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8]"
                  placeholder="Smith" data-testid="last-name-input" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input required type="email" value={form.email} onChange={e => updateForm('email', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8]"
                placeholder="john@example.com" data-testid="email-input" />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <div className="relative">
                <input required type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => updateForm('password', e.target.value)} minLength={8}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8]"
                  placeholder="Minimum 8 characters" data-testid="password-input" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Device Brand */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Device Brand *</label>
              <select required value={form.device_brand} onChange={e => updateForm('device_brand', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8]"
                data-testid="device-brand-select">
                <option value="">Select your device brand</option>
                {DEVICE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Device Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Device Type *</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {DEVICE_TYPES.map(dt => (
                  <button type="button" key={dt.value}
                    onClick={() => updateForm('device_type', dt.value)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      form.device_type === dt.value
                        ? 'border-[#0056A8] bg-blue-50 text-[#0056A8]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                    data-testid={`device-type-${dt.value.replace(/\s+/g, '-').toLowerCase()}`}
                  >
                    {dt.icon}
                    <span className="leading-tight">{dt.value}</span>
                  </button>
                ))}
              </div>
              {!form.device_type && <p className="text-xs text-gray-400 mt-1">Please select your device type</p>}
            </div>

            {/* Android Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <input type="checkbox" id="disclaimer" checked={form.accepted_disclaimer}
                  onChange={e => updateForm('accepted_disclaimer', e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#0056A8] shrink-0"
                  data-testid="disclaimer-checkbox" />
                <label htmlFor="disclaimer" className="text-sm text-amber-800 cursor-pointer leading-relaxed">
                  <strong>Device Compatibility Notice:</strong> Our App may not be supported on older Android devices with versions older than Android 12. Please check your device is fully updated and has a more recent version of Android for App support such as Android 13 or newer.
                </label>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting || !form.device_type}
              className="w-full bg-[#0056A8] text-white py-3.5 rounded-xl font-semibold text-base hover:bg-[#0066c8] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              data-testid="register-submit-btn">
              {submitting ? <Loader className="w-5 h-5 animate-spin" /> : null}
              {submitting ? 'Creating Your Account...' : 'Create Account & Get PIN'}
            </button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?&nbsp;
              <Link to="/customer-login" className="text-[#0056A8] font-medium hover:underline">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    );
  }

  // Landing page
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#001f4d] via-[#003580] to-[#0056A8] text-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Tv className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">TV Service</span>
          </div>
          <Link to="/customer-login" className="text-white/80 hover:text-white text-sm font-medium border border-white/30 px-4 py-1.5 rounded-full hover:border-white transition-colors">
            Sign In
          </Link>
        </div>

        <div className="max-w-6xl mx-auto px-6 py-20 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div>
              <span className="inline-block bg-white/20 text-white/90 text-sm font-medium px-3 py-1 rounded-full mb-4">
                Premium IPTV Service
              </span>
              <h1 className="text-5xl font-extrabold leading-tight">
                Entertainment,<br />Unlimited.
              </h1>
              <p className="text-white/80 text-lg mt-4 leading-relaxed">
                Live TV, on-demand movies & shows, cloud recordings, and more — all in one place on your Android device.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setStep('form')}
                className="bg-white text-[#0056A8] px-8 py-4 rounded-xl font-bold text-base hover:bg-gray-100 transition-colors shadow-lg"
                data-testid="get-started-btn">
                Get Started — Free Setup
              </button>
              <Link to="/portal"
                className="border border-white/40 text-white px-8 py-4 rounded-xl font-medium text-base hover:bg-white/10 transition-colors text-center">
                Support Portal
              </Link>
            </div>
            <p className="text-white/60 text-sm">No QR stickers needed. Activate instantly with your 6-digit PIN.</p>
          </div>

          {/* Feature preview card */}
          <div className="hidden lg:block">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[#0056A8] rounded-lg flex items-center justify-center">
                  <Tv className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-bold text-white">Your Account</p>
                  <p className="text-white/60 text-xs">Ready to activate</p>
                </div>
              </div>
              <div className="bg-white/10 rounded-xl p-4 text-center">
                <p className="text-white/70 text-xs mb-2">Activation PIN</p>
                <div className="flex justify-center gap-2">
                  {['8','4','7','2','9','1'].map((d, i) => (
                    <div key={i} className="w-9 h-10 bg-white rounded-lg flex items-center justify-center text-[#0056A8] text-xl font-bold">
                      {d}
                    </div>
                  ))}
                </div>
                <p className="text-white/60 text-xs mt-2">Enter in your device app</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['Live TV', 'VOD', 'Recordings', '4K Ready'].map(f => (
                  <div key={f} className="bg-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-white text-sm">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Everything you need</h2>
          <p className="text-gray-500 mt-2">One subscription. Every screen.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f, i) => (
            <div key={i} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 bg-[#0056A8] rounded-xl flex items-center justify-center mb-4">
                <Tv className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA section */}
      <div className="bg-[#0056A8] text-white">
        <div className="max-w-3xl mx-auto px-6 py-16 text-center space-y-6">
          <h2 className="text-3xl font-bold">Ready to get started?</h2>
          <p className="text-white/80">Create your account in minutes and activate your device instantly with your 6-digit PIN.</p>
          <button onClick={() => setStep('form')}
            className="bg-white text-[#0056A8] px-10 py-4 rounded-xl font-bold text-base hover:bg-gray-100 transition-colors shadow-lg"
            data-testid="cta-get-started-btn">
            Create Your Account
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Tv className="w-4 h-4 text-[#0056A8]" />
            <span className="font-medium">TV Service</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/portal" className="hover:text-[#0056A8]">Support Portal</Link>
            <Link to="/portal/faq" className="hover:text-[#0056A8]">FAQ</Link>
            <Link to="/portal/status" className="hover:text-[#0056A8]">Service Status</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
