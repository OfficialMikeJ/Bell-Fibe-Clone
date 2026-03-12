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
import { Loader2, Shield, KeyRound, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Login state
  const [loginStep, setLoginStep] = useState('credentials'); // 'credentials' | '2fa'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password reset state
  const [showReset, setShowReset] = useState(false);
  const [resetStep, setResetStep] = useState('username'); // 'username' | 'questions'
  const [resetUsername, setResetUsername] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState([]);
  const [securityAnswers, setSecurityAnswers] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (loginStep === 'credentials') {
      const result = await login(username, password);
      if (result.success) {
        navigate('/admin');
      } else if (result.error === '2FA code required') {
        setLoginStep('2fa');
      } else {
        setError(result.error || 'Login failed');
      }
    } else if (loginStep === '2fa') {
      const result = await login(username, password, twoFaCode);
      if (result.success) {
        navigate('/admin');
      } else {
        setError(result.error || 'Invalid 2FA code');
      }
    }

    setLoading(false);
  };

  const handleFetchSecurityQuestions = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetLoading(true);
    try {
      const response = await axios.get(`${API}/auth/security-questions/${resetUsername}`);
      setSecurityQuestions(response.data.questions);
      const initialAnswers = {};
      response.data.questions.forEach((_, i) => { initialAnswers[i] = ''; });
      setSecurityAnswers(initialAnswers);
      setResetStep('questions');
    } catch (err) {
      setResetError(err.response?.data?.detail || 'User not found or no security questions configured');
    } finally {
      setResetLoading(false);
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setResetError('');

    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }

    setResetLoading(true);
    try {
      const security_answers = securityQuestions.map((q, i) => ({
        question: q,
        answer: securityAnswers[i] || ''
      }));
      await axios.post(`${API}/auth/password-reset`, {
        username: resetUsername,
        security_answers,
        new_password: newPassword
      });
      toast.success('Password reset successfully! Please login with your new password.');
      setShowReset(false);
      setResetStep('username');
      setResetUsername('');
      setSecurityQuestions([]);
      setSecurityAnswers({});
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setResetError(err.response?.data?.detail || 'Password reset failed. Check your answers.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCloseReset = (open) => {
    setShowReset(open);
    if (!open) {
      setResetStep('username');
      setResetError('');
      setResetUsername('');
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#2a2a2a] border-gray-700">
        <CardHeader className="space-y-1">
          {loginStep === 'credentials' ? (
            <>
              <CardTitle className="text-3xl font-bold text-white text-center" data-testid="login-title">
                IPTV Admin
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
                  <Label htmlFor="username" className="text-white">Username</Label>
                  <Input
                    id="username"
                    data-testid="username-input"
                    type="text"
                    placeholder="admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
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
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-[#3a3a3a] border-gray-600 text-white"
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Demo: admin / admin123</span>
                  <button
                    type="button"
                    data-testid="forgot-password-link"
                    onClick={() => { setShowReset(true); setResetStep('username'); setResetError(''); }}
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
                {resetStep === 'username' ? 'Forgot Password' : 'Security Questions'}
              </DialogTitle>
            </div>
          </DialogHeader>

          {resetStep === 'username' ? (
            <form onSubmit={handleFetchSecurityQuestions} className="space-y-4 py-2">
              <p className="text-gray-400 text-sm">
                Enter your admin username to retrieve your security questions.
              </p>
              {resetError && (
                <Alert className="bg-red-900/20 border-red-900">
                  <AlertDescription className="text-red-400 text-sm">{resetError}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="reset_username" className="text-white">Username</Label>
                <Input
                  id="reset_username"
                  data-testid="reset-username-input"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  placeholder="admin"
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
                  data-testid="fetch-questions-btn"
                  disabled={resetLoading || !resetUsername}
                  className="bg-[#0056A8] hover:bg-[#0066c8]"
                >
                  {resetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4 py-2">
              <p className="text-gray-400 text-sm">
                Answer your security questions and enter a new password.
              </p>
              {resetError && (
                <Alert className="bg-red-900/20 border-red-900">
                  <AlertDescription className="text-red-400 text-sm">{resetError}</AlertDescription>
                </Alert>
              )}
              {securityQuestions.map((question, index) => (
                <div key={index} className="space-y-1">
                  <Label className="text-white text-sm">{question}</Label>
                  <Input
                    data-testid={`security-answer-${index}`}
                    value={securityAnswers[index] || ''}
                    onChange={(e) => setSecurityAnswers({ ...securityAnswers, [index]: e.target.value })}
                    placeholder="Your answer"
                    required
                    className="bg-[#2a2a2a] border-gray-600 text-white"
                  />
                </div>
              ))}
              <div className="space-y-2 border-t border-gray-700 pt-4">
                <Label htmlFor="new_pass" className="text-white">New Password</Label>
                <Input
                  id="new_pass"
                  data-testid="new-password-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_pass" className="text-white">Confirm New Password</Label>
                <Input
                  id="confirm_pass"
                  data-testid="confirm-password-input"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => { setResetStep('username'); setResetError(''); }}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="submit"
                  data-testid="reset-password-btn"
                  disabled={resetLoading}
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
