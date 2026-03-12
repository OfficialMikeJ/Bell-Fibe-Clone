import React, { useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Shield, Key, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TwoFactorSetup = ({ token, twoFaEnabled, onStatusChange }) => {
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isDisableDialogOpen, setIsDisableDialogOpen] = useState(false);

  const getHeaders = () => ({ Authorization: `Bearer ${token}` });

  const handleSetup2FA = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/2fa/setup`, {}, { headers: getHeaders() });
      setSetupData(response.data);
      setIsSetupDialogOpen(true);
      toast.success('2FA setup initiated');
    } catch (error) {
      toast.error('Failed to setup 2FA');
      console.error('2FA setup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API}/auth/2fa/enable`,
        null,
        {
          params: { verification_code: verificationCode },
          headers: getHeaders()
        }
      );
      toast.success('2FA enabled successfully!');
      setIsSetupDialogOpen(false);
      setVerificationCode('');
      setSetupData(null);
      onStatusChange && onStatusChange(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API}/auth/2fa/disable`,
        null,
        {
          params: { verification_code: verificationCode },
          headers: getHeaders()
        }
      );
      toast.success('2FA disabled');
      setIsDisableDialogOpen(false);
      setVerificationCode('');
      onStatusChange && onStatusChange(false);
    } catch (error) {
      toast.error('Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-400" />
            <div>
              <CardTitle className="text-white">Two-Factor Authentication (2FA)</CardTitle>
              <CardDescription className="text-gray-400">
                Add an extra layer of security with Google Authenticator
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#1a1a1a] rounded">
            <div className="flex items-center gap-3">
              {twoFaEnabled ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-white font-medium">2FA Enabled</p>
                    <p className="text-sm text-gray-400">Your account is protected</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-white font-medium">2FA Disabled</p>
                    <p className="text-sm text-gray-400">Enable for better security</p>
                  </div>
                </>
              )}
            </div>
            {!twoFaEnabled ? (
              <Button
                onClick={handleSetup2FA}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable 2FA'}
              </Button>
            ) : (
              <Button
                onClick={() => setIsDisableDialogOpen(true)}
                variant="outline"
                className="bg-transparent border-red-600 text-red-400 hover:bg-red-900/20"
              >
                Disable 2FA
              </Button>
            )}
          </div>

          <Alert className="bg-blue-900/20 border-blue-900">
            <Key className="w-4 h-4" />
            <AlertDescription className="text-blue-400 text-sm ml-2">
              2FA requires the Google Authenticator app on your phone. Download it from your app store before enabling.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Setup Dialog */}
      <Dialog open={isSetupDialogOpen} onOpenChange={setIsSetupDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">Setup Two-Factor Authentication</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="text-center space-y-4">
              <p className="text-gray-400 text-sm">
                Scan this QR code with Google Authenticator app
              </p>
              
              {setupData?.qr_code && (
                <div className="flex justify-center bg-white p-4 rounded">
                  <img
                    src={setupData.qr_code}
                    alt="2FA QR Code"
                    className="w-48 h-48"
                  />
                </div>
              )}

              <div className="bg-[#2a2a2a] p-3 rounded">
                <p className="text-xs text-gray-400 mb-1">Or enter this code manually:</p>
                <code className="text-white text-sm font-mono">{setupData?.secret}</code>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verify_code" className="text-white">Enter 6-digit code from app</Label>
              <Input
                id="verify_code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="bg-[#2a2a2a] border-gray-600 text-white text-center text-2xl tracking-widest"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsSetupDialogOpen(false);
                setVerificationCode('');
              }}
              variant="outline"
              className="bg-transparent border-gray-600 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEnable2FA}
              disabled={loading || verificationCode.length !== 6}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable 2FA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={isDisableDialogOpen} onOpenChange={setIsDisableDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">Disable Two-Factor Authentication</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Alert className="bg-orange-900/20 border-orange-900">
              <AlertDescription className="text-orange-400">
                Disabling 2FA will make your account less secure. Enter your current 2FA code to confirm.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="disable_code" className="text-white">Enter 6-digit code</Label>
              <Input
                id="disable_code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="bg-[#2a2a2a] border-gray-600 text-white text-center text-2xl tracking-widest"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsDisableDialogOpen(false);
                setVerificationCode('');
              }}
              variant="outline"
              className="bg-transparent border-gray-600 text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDisable2FA}
              disabled={loading || verificationCode.length !== 6}
              className="bg-red-600 hover:bg-red-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Disable 2FA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TwoFactorSetup;
