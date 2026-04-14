import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Loader2, Shield, KeyRound, ArrowLeft, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loginStep, setLoginStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [newGeneratedPassword, setNewGeneratedPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (loginStep === 'credentials') {
      const result = await login(email, password);
      if (result.success) {
        navigate('/admin');
      } else if (result.error === '2FA code required') {
        setLoginStep('2fa');
      } else {
        setError(result.error || 'Login failed');
      }
    } else if (loginStep === '2fa') {
      const result = await login(email, password, twoFaCode);
      if (result.success) {
        navigate('/admin');
      } else {
        setError(result.error || 'Invalid 2FA code');
      }
    }

    setLoading(false);
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setNewGeneratedPassword('');
    setResetLoading(true);
    try {
      const response = await axios.post(`${API}/auth/password-reset`, {
        email: resetEmail
      });
      setNewGeneratedPassword(response.data.new_password);
      toast.success('Password has been reset');
    } catch (err) {
      setResetError(err.response?.data?.detail || 'Password reset failed');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCloseReset = (open) => {
    setShowReset(open);
    if (!open) {
      setResetError('');
      setResetEmail('');
      setNewGeneratedPassword('');
      setShowNewPassword(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Password copied'));
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#2a2a2a] border-gray-700">
        <CardHeader className="space-y-1">
          {loginStep === 'credentials' ? (
            <>
              <CardTitle className="text-3xl font-bold text-white text-center" data-testid="login-title">
                IPTV Admin · StreamVault
              </CardTitle>
              <CardDescription className="text-gray-400 text-center">
                Enter your credentials to access the admin dashboard
              </CardDescription>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 justify-center mb-2">
                <Shield className="w-8 h-8 text-blue-400" />
              </div>
              <CardTitle className="text-2xl font-bold text-white text-center" data-testid="2fa-title">
                Two-Factor Verification
              </CardTitle>
              <CardDescription className="text-gray-400 text-center">
                Enter the 6-digit code from your Google Authenticator app
              </CardDescription>
            </>
          )}
        </CardHeader>

        <form onSubmit={handleLoginSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-900/20 border-red-900 text-red-400" data-testid="login-error">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loginStep === 'credentials' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white">Email</Label>
                  <Input
                    id="email"
                    data-testid="email-input"
                    type="email"
                    placeholder="admin@streamvault.ca"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-[#3a3a3a] border-gray-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">Password</Label>
                  <Input
                    id="password"
                    data-testid="password-input"
                    type="password"
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-[#3a3a3a] border-gray-600 text-white"
                  />
                </div>
                <div className="flex justify-end items-center">
                  <button
                    type="button"
                    data-testid="forgot-password-link"
                    onClick={() => { setShowReset(true); setResetError(''); setNewGeneratedPassword(''); }}
                    className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
                  >
                    Forgot Password?
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="twofa" className="text-white">Authentication Code</Label>
                  <Input
                    id="twofa"
                    data-testid="twofa-input"
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    maxLength={6}
                    value={twoFaCode}
                    onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    autoFocus
                    className="bg-[#3a3a3a] border-gray-600 text-white text-center text-2xl tracking-widest"
                  />
                </div>
                <button
                  type="button"
                  data-testid="back-to-credentials"
                  onClick={() => { setLoginStep('credentials'); setTwoFaCode(''); setError(''); }}
                  className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </button>
              </>
            )}
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              data-testid="login-submit-btn"
              className="w-full bg-[#0056A8] hover:bg-[#0066c8] text-white"
              disabled={loading || (loginStep === '2fa' && twoFaCode.length !== 6)}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {loginStep === '2fa' ? 'Verifying...' : 'Signing in...'}
                </>
              ) : (
                loginStep === '2fa' ? 'Verify Code' : 'Sign In'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={showReset} onOpenChange={handleCloseReset}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-md" data-testid="password-reset-dialog">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <KeyRound className="w-6 h-6 text-blue-400" />
              <DialogTitle className="text-xl text-white">
                {newGeneratedPassword ? 'New Password Generated' : 'Reset Password'}
              </DialogTitle>
            </div>
          </DialogHeader>

          {newGeneratedPassword ? (
            <div className="space-y-4 py-2">
              <p className="text-gray-400 text-sm">
                Your password has been reset. Save this new password — it will not be shown again.
              </p>
              <div className="bg-[#2a2a2a] border border-gray-600 rounded-lg p-4">
                <Label className="text-gray-400 text-xs mb-2 block">New Password</Label>
                <div className="flex items-center gap-3">
                  <code
                    className="text-green-400 text-lg font-mono tracking-wider flex-1"
                    data-testid="generated-password"
                  >
                    {showNewPassword ? newGeneratedPassword : '••••••••••'}
                  </code>
                  <button
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="text-gray-500 hover:text-gray-300"
                    data-testid="toggle-password-visibility"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(newGeneratedPassword)}
                    className="text-gray-500 hover:text-gray-300"
                    data-testid="copy-password-btn"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => handleCloseReset(false)} className="bg-[#0056A8] hover:bg-[#0066c8]">
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4 py-2">
              <p className="text-gray-400 text-sm">
                Enter your admin email. A new random password will be generated.
              </p>
              {resetError && (
                <Alert className="bg-red-900/20 border-red-900">
                  <AlertDescription className="text-red-400 text-sm">{resetError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="reset_email" className="text-white">Email</Label>
                <Input
                  id="reset_email"
                  data-testid="reset-email-input"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="admin@streamvault.ca"
                  required
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <DialogFooter>
                <Button type="button" onClick={() => setShowReset(false)} className="bg-gray-600 hover:bg-gray-700">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  data-testid="reset-password-btn"
                  disabled={resetLoading || !resetEmail}
                  className="bg-[#0056A8] hover:bg-[#0066c8]"
                >
                  {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reset Password'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
