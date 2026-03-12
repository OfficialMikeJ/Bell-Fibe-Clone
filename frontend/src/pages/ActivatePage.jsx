import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, Loader, Tv, QrCode, Copy, Lock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ActivatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') || '';
  const prefilledPin = searchParams.get('pin') || '';

  // Mode: 'code' = activation_code (admin-created device), 'pin' = 6-digit customer PIN
  const [mode, setMode] = useState(prefilledPin ? 'pin' : (code ? 'code' : 'choose'));
  const [step, setStep] = useState('lookup'); // lookup | confirm | activating | success | error | already-active
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [activationCode, setActivationCode] = useState(code);
  const [pin, setPin] = useState(prefilledPin);
  const [errorMsg, setErrorMsg] = useState('');
  const [userId, setUserId] = useState('');
  const [copied, setCopied] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);

  useEffect(() => {
    if (prefilledPin) {
      setMode('pin');
      setStep('pin-confirm');
    } else if (code) {
      lookupDevice(code);
    }
  }, [code, prefilledPin]);

  const lookupDevice = async (c) => {
    try {
      const res = await axios.get(`${API}/devices/by-code/${c}`);
      setDeviceInfo(res.data);
      if (res.data.status === 'active') {
        setStep('already-active');
      } else {
        setStep('confirm');
      }
    } catch {
      setStep('error');
      setErrorMsg('Invalid or expired activation code. Please check your code and try again.');
    }
  };

  const handlePinActivate = async () => {
    if (!pin || pin.length !== 6) {
      setErrorMsg('Please enter all 6 digits.');
      return;
    }
    setStep('activating');
    setErrorMsg('');
    try {
      const res = await axios.post(`${API}/customer/activate-with-pin?pin=${pin}`);
      setUserId(res.data.user_id);
      setStep('success');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Activation failed.';
      const status = err.response?.status;
      if (status === 429) {
        const match = detail.match(/(\d+) minute/);
        setLockoutMinutes(match ? parseInt(match[1]) : 45);
        setStep('locked');
      } else {
        setStep('error');
        setErrorMsg(detail);
      }
    }
  };

  const handleLookup = (e) => {
    e.preventDefault();
    if (!activationCode.trim()) return;
    setStep('lookup');
    lookupDevice(activationCode.trim());
  };

  const handleActivate = async () => {
    setStep('activating');
    try {
      const res = await axios.post(`${API}/devices/activate`, {
        activation_code: activationCode,
      });
      const generatedUserId = res.data.device?.user_id || `USR-${res.data.device?.id?.slice(0, 8).toUpperCase()}`;
      setUserId(generatedUserId);
      setStep('success');
    } catch (err) {
      setStep('error');
      setErrorMsg(
        err.response?.data?.detail ||
        'Activation failed. Please ensure your device is connected from Canada and try again.'
      );
    }
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003d7a] to-[#0056A8] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#0056A8] rounded-2xl mb-4">
            <Tv className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Device Activation</h1>
          <p className="text-gray-500 mt-1 text-sm">Activate your IPTV box to start watching</p>
        </div>

        {/* Mode: Choose activation method */}
        {mode === 'choose' && step === 'lookup' && !code && !prefilledPin && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center mb-2">How would you like to activate?</p>
            <button
              onClick={() => setMode('pin')}
              className="w-full flex items-center gap-3 p-4 border-2 border-[#0056A8] rounded-xl hover:bg-blue-50 transition-colors"
              data-testid="choose-pin-mode-btn"
            >
              <div className="w-10 h-10 bg-[#0056A8] rounded-lg flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">6-Digit PIN</p>
                <p className="text-xs text-gray-500">Enter the PIN from your My Account page</p>
              </div>
            </button>
            <button
              onClick={() => setMode('code')}
              className="w-full flex items-center gap-3 p-4 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              data-testid="choose-code-mode-btn"
            >
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5 text-gray-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Activation Code</p>
                <p className="text-xs text-gray-500">Use an admin-provided activation code</p>
              </div>
            </button>
          </div>
        )}

        {/* Mode: PIN entry */}
        {mode === 'pin' && (step === 'lookup' || step === 'pin-confirm') && (
          <div className="space-y-5">
            <div className="text-center">
              <p className="text-sm text-gray-600">Enter the <strong>6-digit PIN</strong> from your account page at <strong>/my-account</strong></p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 text-center">Activation PIN</label>
              <div className="flex justify-center gap-2">
                {[0,1,2,3,4,5].map(i => (
                  <input
                    key={i}
                    id={`pin-digit-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={pin[i] || ''}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      const arr = pin.split('');
                      arr[i] = val;
                      const newPin = arr.join('').slice(0, 6);
                      setPin(newPin);
                      if (val && i < 5) document.getElementById(`pin-digit-${i+1}`)?.focus();
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !pin[i] && i > 0) {
                        document.getElementById(`pin-digit-${i-1}`)?.focus();
                      }
                    }}
                    className="w-12 h-14 text-center text-xl font-bold border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#0056A8] text-gray-900"
                    data-testid={`pin-input-digit-${i}`}
                  />
                ))}
              </div>
            </div>
            {errorMsg && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}
            <button
              onClick={handlePinActivate}
              disabled={pin.length !== 6}
              className="w-full bg-[#0056A8] text-white py-3 rounded-xl font-semibold hover:bg-[#0066c8] transition-colors disabled:opacity-50"
              data-testid="activate-with-pin-btn"
            >
              Activate with PIN
            </button>
            <button onClick={() => setMode('choose')} className="w-full text-sm text-gray-400 hover:text-gray-600">
              ← Other activation methods
            </button>
          </div>
        )}

        {/* Lockout screen */}
        {step === 'locked' && (
          <div className="text-center space-y-4">
            <Lock className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Account Locked</h2>
            <p className="text-gray-600 text-sm">
              Too many failed activation attempts. Your account is locked for <strong>{lockoutMinutes} minute(s)</strong>.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              Please wait {lockoutMinutes} minute(s) before trying again. If you need help, visit the support portal.
            </div>
            <button onClick={() => navigate('/portal/support')} className="w-full text-[#0056A8] text-sm underline">
              Contact Support
            </button>
          </div>
        )}

        {/* Step: Enter code manually */}
        {mode === 'code' && step === 'lookup' && !code && (
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activation Code
              </label>
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-gray-400 shrink-0" />
                <input
                  type="text"
                  value={activationCode}
                  onChange={(e) => setActivationCode(e.target.value)}
                  placeholder="Enter your activation code"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8]"
                  data-testid="activation-code-input"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Enter the activation code provided by your service admin</p>
            </div>
            <button
              type="submit"
              className="w-full bg-[#0056A8] text-white py-3 rounded-lg font-semibold hover:bg-[#0066c8] transition-colors"
              data-testid="lookup-device-btn"
            >
              Look Up Device
            </button>
            <button type="button" onClick={() => setMode('choose')} className="w-full text-sm text-gray-400 hover:text-gray-600">
              ← Other activation methods
            </button>
          </form>
        )}

        {/* Step: Loading */}
        {step === 'lookup' && code && (
          <div className="text-center py-8">
            <Loader className="w-10 h-10 text-[#0056A8] animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Looking up your device...</p>
          </div>
        )}

        {/* Step: Confirm activation */}
        {step === 'confirm' && deviceInfo && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-600 font-medium mb-1">Device Found</p>
              <p className="text-xl font-bold text-blue-900">{deviceInfo.device_name}</p>
              <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                Pending Activation
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-2">
              <p>By activating this device you confirm:</p>
              <ul className="space-y-1 pl-4">
                <li className="flex items-start gap-2">
                  <span className="text-[#0056A8] font-bold mt-0.5">•</span>
                  You are located in Canada
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#0056A8] font-bold mt-0.5">•</span>
                  This is your authorized device
                </li>
              </ul>
            </div>
            <button
              onClick={handleActivate}
              className="w-full bg-[#0056A8] text-white py-3 rounded-lg font-semibold hover:bg-[#0066c8] transition-colors"
              data-testid="confirm-activate-btn"
            >
              Activate My Device
            </button>
          </div>
        )}

        {/* Step: Already active */}
        {step === 'already-active' && deviceInfo && (
          <div className="text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Already Activated</h2>
            <p className="text-gray-600 text-sm">
              <strong>{deviceInfo.device_name}</strong> is already active. If you need help, visit the support portal.
            </p>
            <button
              onClick={() => navigate('/portal')}
              className="w-full bg-[#0056A8] text-white py-3 rounded-lg font-semibold hover:bg-[#0066c8] transition-colors"
            >
              Go to Support Portal
            </button>
          </div>
        )}

        {/* Step: Activating spinner */}
        {step === 'activating' && (
          <div className="text-center py-8">
            <Loader className="w-10 h-10 text-[#0056A8] animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Activating your device...</p>
            <p className="text-gray-400 text-xs mt-1">Verifying your location</p>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="text-center space-y-5">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Activation Successful!</h2>
              <p className="text-gray-500 text-sm mt-1">Your device is now active and ready to use.</p>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left">
              <p className="text-xs text-gray-500 mb-1">Your User ID (save this for support)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono text-gray-900 bg-white border border-gray-200 rounded px-2 py-1">
                  {userId}
                </code>
                <button
                  onClick={copyUserId}
                  className="p-1.5 text-gray-500 hover:text-[#0056A8] transition-colors"
                  title="Copy"
                  data-testid="copy-user-id-btn"
                >
                  {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              onClick={() => navigate('/portal')}
              className="w-full bg-[#0056A8] text-white py-3 rounded-lg font-semibold hover:bg-[#0066c8] transition-colors"
            >
              Visit Support Portal
            </button>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="text-center space-y-4">
            <XCircle className="w-16 h-16 text-red-500 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Activation Failed</h2>
            <p className="text-red-600 text-sm">{errorMsg}</p>
            <button
              onClick={() => { setStep('lookup'); setActivationCode(''); }}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/portal')}
              className="w-full text-[#0056A8] text-sm underline"
            >
              Visit Support Portal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
