import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useService } from '../contexts/ServiceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Settings as SettingsIcon, Server, Lock, Globe, Save } from 'lucide-react';
import { toast } from 'sonner';
import TwoFactorSetup from './TwoFactorSetup';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SettingsTab = ({ token }) => {
  const { user } = useAuth();
  const { serviceName, updateServiceName } = useService();
  const [loading, setLoading] = useState(false);
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [serviceConfig, setServiceConfig] = useState({
    service_name: '',
    custom_domain: '',
    guide_domain: '',
    admin_domain: '',
    uptime_kuma_url: '',
  });

  const getHeaders = () => ({ Authorization: `Bearer ${token}` });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // Get admin 2FA status
      const authResponse = await axios.get(`${API}/auth/verify`, { headers: getHeaders() });
      setTwoFaEnabled(authResponse.data.two_fa_enabled || false);

      // Get service config from the dedicated endpoint
      const configResponse = await axios.get(`${API}/setup/config`);
      setServiceConfig({
        service_name: configResponse.data?.service_name || 'TV Service',
        custom_domain: '',
        guide_domain: '',
        admin_domain: '',
        uptime_kuma_url: configResponse.data?.uptime_kuma_url || '',
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveServiceConfig = async () => {
    setLoading(true);
    try {
      await axios.post(
        `${API}/setup/service-config`,
        null,
        {
          params: {
            service_name: serviceConfig.service_name,
            domain_name: serviceConfig.custom_domain,
            uptime_kuma_url: serviceConfig.uptime_kuma_url,
          },
          headers: getHeaders()
        }
      );
      localStorage.setItem('service_name', serviceConfig.service_name);
      updateServiceName(serviceConfig.service_name);
      toast.success('Service configuration saved');
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="w-6 h-6 text-white" />
        <h2 className="text-2xl font-semibold text-white">Settings</h2>
      </div>

      {/* Service Configuration */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-blue-400" />
            <div>
              <CardTitle className="text-white">Service Configuration</CardTitle>
              <CardDescription className="text-gray-400">
                Configure your service name and branding
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service_name" className="text-white">Service Name</Label>
            <Input
              id="service_name"
              value={serviceConfig.service_name}
              onChange={(e) => setServiceConfig({ ...serviceConfig, service_name: e.target.value })}
              placeholder="TV Service"
              className="bg-[#1a1a1a] border-gray-600 text-white"
            />
            <p className="text-xs text-gray-400">This name appears throughout the system</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="uptime_kuma_url" className="text-white">Uptime Kuma Status Page URL</Label>
            <Input
              id="uptime_kuma_url"
              value={serviceConfig.uptime_kuma_url}
              onChange={(e) => setServiceConfig({ ...serviceConfig, uptime_kuma_url: e.target.value })}
              placeholder="https://status.yourdomain.com"
              className="bg-[#1a1a1a] border-gray-600 text-white"
            />
            <p className="text-xs text-gray-400">
              Your self-hosted Uptime Kuma URL. This is displayed on the customer support portal's Service Status page.
              &nbsp;<a href="https://uptime.kuma.pet" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Learn more about Uptime Kuma</a>
            </p>
          </div>

          <Button
            onClick={handleSaveServiceConfig}
            disabled={loading}
            className="bg-[#0056A8] hover:bg-[#0066c8]"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <TwoFactorSetup
        token={token}
        twoFaEnabled={twoFaEnabled}
        onStatusChange={(status) => setTwoFaEnabled(status)}
      />

      {/* Domain Configuration */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-green-400" />
            <div>
              <CardTitle className="text-white">Domain Configuration</CardTitle>
              <CardDescription className="text-gray-400">
                Custom domain settings for production deployment
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="custom_domain" className="text-white">Main Domain</Label>
            <Input
              id="custom_domain"
              value={serviceConfig.custom_domain}
              onChange={(e) => setServiceConfig({ ...serviceConfig, custom_domain: e.target.value })}
              placeholder="yourdomain.com"
              className="bg-[#1a1a1a] border-gray-600 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin_domain" className="text-white">Admin Domain</Label>
            <Input
              id="admin_domain"
              value={serviceConfig.admin_domain}
              onChange={(e) => setServiceConfig({ ...serviceConfig, admin_domain: e.target.value })}
              placeholder="admin.yourdomain.com"
              className="bg-[#1a1a1a] border-gray-600 text-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guide_domain" className="text-white">Guide Domain (Android App)</Label>
            <Input
              id="guide_domain"
              value={serviceConfig.guide_domain}
              onChange={(e) => setServiceConfig({ ...serviceConfig, guide_domain: e.target.value })}
              placeholder="guide.yourdomain.com"
              className="bg-[#1a1a1a] border-gray-600 text-white"
            />
          </div>

          <div className="bg-blue-900/20 border border-blue-900 rounded p-3">
            <p className="text-blue-400 text-sm">
              ℹ️ Domain configuration requires manual setup. See <code className="text-white">/app/CUSTOM_DOMAIN_SETUP.md</code> for instructions.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-purple-400" />
            <div>
              <CardTitle className="text-white">Account Information</CardTitle>
              <CardDescription className="text-gray-400">
                Your admin account details
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-[#1a1a1a] rounded">
            <span className="text-gray-400">Username:</span>
            <span className="text-white font-medium">{user?.username}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-[#1a1a1a] rounded">
            <span className="text-gray-400">2FA Status:</span>
            <span className={twoFaEnabled ? 'text-green-400' : 'text-orange-400'}>
              {twoFaEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex justify-between items-center p-3 bg-[#1a1a1a] rounded">
            <span className="text-gray-400">Account ID:</span>
            <span className="text-white font-mono text-xs">{user?.id?.substring(0, 16)}...</span>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Environment:</span>
            <span className="text-white">{process.env.NODE_ENV || 'development'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Backend URL:</span>
            <span className="text-white text-xs font-mono">{BACKEND_URL}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Version:</span>
            <span className="text-white">1.0.0</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsTab;
