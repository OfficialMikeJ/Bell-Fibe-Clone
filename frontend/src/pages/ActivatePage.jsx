import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, Loader, Tv, QrCode, Copy } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ActivatePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get('code') || '';

  const [step, setStep] = useState('lookup'); // lookup | confirm | activating | success | error
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [activationCode, setActivationCode] = useState(code);
  const [errorMsg, setErrorMsg] = useState('');
  const [userId, setUserId] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (code) {
      lookupDevice(code);
    }
  }, [code]);

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

        {/* Step: Enter code manually */}
        {step === 'lookup' && !code && (
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
              <p className="text-xs text-gray-400 mt-1">Find this code on your device screen or QR sticker</p>
            </div>
            <button
              type="submit"
              className="w-full bg-[#0056A8] text-white py-3 rounded-lg font-semibold hover:bg-[#0066c8] transition-colors"
              data-testid="lookup-device-btn"
            >
              Look Up Device
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
