import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Shield, ArrowLeft } from 'lucide-react';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loginStep, setLoginStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
    </div>
  );
};

export default LoginPage;
