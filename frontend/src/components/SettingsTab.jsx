import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useService } from '../contexts/ServiceContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Settings as SettingsIcon, Server, Lock, Globe, Save, Smartphone, Upload, Trash2 } from 'lucide-react';
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

  // APK state
  const [apkFile, setApkFile] = useState(null);
  const [apkForm, setApkForm] = useState({ version: '', version_code: '', release_notes: '', required: false });
  const [apkUploading, setApkUploading] = useState(false);
  const [apkReleases, setApkReleases] = useState([]);
  const apkInputRef = useRef(null);

  const getHeaders = () => ({ Authorization: `Bearer ${token}` });

  useEffect(() => {
    fetchSettings();
    fetchApkReleases();
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

  const fetchApkReleases = async () => {
    try {
      const res = await axios.get(`${API}/apk/releases`, { headers: getHeaders() });
      setApkReleases(res.data || []);
    } catch {
      // silently fail — not critical
    }
  };

  const handleApkUpload = async () => {
    if (!apkFile) return toast.error('Please select an APK file');
    if (!apkForm.version.trim()) return toast.error('Version name is required (e.g. 1.2.0)');
    if (!apkForm.version_code || isNaN(parseInt(apkForm.version_code))) return toast.error('Version code must be a number');

    const fd = new FormData();
    fd.append('file', apkFile);
    fd.append('version', apkForm.version.trim());
    fd.append('version_code', parseInt(apkForm.version_code));
    fd.append('release_notes', apkForm.release_notes);
    fd.append('required', apkForm.required);

    setApkUploading(true);
    try {
      const res = await axios.post(`${API}/apk/upload`, fd, { headers: getHeaders() });
      toast.success(`APK v${res.data.version} uploaded (${res.data.file_size_mb} MB)`);
      setApkFile(null);
      setApkForm({ version: '', version_code: '', release_notes: '', required: false });
      if (apkInputRef.current) apkInputRef.current.value = '';
      fetchApkReleases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setApkUploading(false);
    }
  };

  const handleDeleteRelease = async (version_code) => {
    if (!window.confirm(`Delete release v${version_code}?`)) return;
    try {
      await axios.delete(`${API}/apk/release/${version_code}`, { headers: getHeaders() });
      toast.success('Release deleted');
      fetchApkReleases();
    } catch {
      toast.error('Failed to delete release');
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

      {/* Android APK Management */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-blue-400" />
            <div>
              <CardTitle className="text-white">Android APK Management</CardTitle>
              <CardDescription className="text-gray-400">
                Upload new app versions — Android devices will be prompted to update automatically
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Upload Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white">APK File</Label>
              <input
                ref={apkInputRef}
                type="file"
                accept=".apk"
                data-testid="apk-file-input"
                onChange={e => setApkFile(e.target.files[0] || null)}
                className="w-full text-sm text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-[#0056A8] file:text-white file:cursor-pointer bg-[#1a1a1a] border border-gray-600 rounded p-1.5 cursor-pointer"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Version Name <span className="text-gray-500 text-xs">(e.g. 1.2.0)</span></Label>
              <Input
                data-testid="apk-version-input"
                value={apkForm.version}
                onChange={e => setApkForm({ ...apkForm, version: e.target.value })}
                placeholder="1.2.0"
                className="bg-[#1a1a1a] border-gray-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Version Code <span className="text-gray-500 text-xs">(integer, must increase each release)</span></Label>
              <Input
                data-testid="apk-version-code-input"
                type="number"
                value={apkForm.version_code}
                onChange={e => setApkForm({ ...apkForm, version_code: e.target.value })}
                placeholder="2"
                className="bg-[#1a1a1a] border-gray-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Release Notes <span className="text-gray-500 text-xs">(optional)</span></Label>
              <Input
                data-testid="apk-release-notes-input"
                value={apkForm.release_notes}
                onChange={e => setApkForm({ ...apkForm, release_notes: e.target.value })}
                placeholder="Bug fixes and improvements"
                className="bg-[#1a1a1a] border-gray-600 text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="apk-required"
              data-testid="apk-required-checkbox"
              checked={apkForm.required}
              onChange={e => setApkForm({ ...apkForm, required: e.target.checked })}
              className="w-4 h-4 accent-blue-500"
            />
            <Label htmlFor="apk-required" className="text-white cursor-pointer">
              Force update — users must update before they can continue
            </Label>
          </div>

          <Button
            data-testid="apk-upload-btn"
            onClick={handleApkUpload}
            disabled={apkUploading || !apkFile}
            className="bg-[#0056A8] hover:bg-[#0066c8]"
          >
            <Upload className="w-4 h-4 mr-2" />
            {apkUploading ? 'Uploading…' : 'Upload APK'}
          </Button>

          {/* Releases Table */}
          {apkReleases.length > 0 && (
            <div className="mt-4">
              <p className="text-gray-400 text-sm mb-2">Uploaded Releases</p>
              <div className="space-y-2">
                {apkReleases.map(r => (
                  <div
                    key={r.version_code}
                    data-testid={`apk-release-${r.version_code}`}
                    className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded border border-gray-700"
                  >
                    <div>
                      <span className="text-white font-medium">v{r.version}</span>
                      <span className="text-gray-500 text-xs ml-2">(code {r.version_code})</span>
                      {r.required && <span className="ml-2 text-xs bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">Force Update</span>}
                      {r.release_notes && <p className="text-gray-400 text-xs mt-0.5">{r.release_notes}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={r.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 text-xs hover:underline"
                      >
                        Download
                      </a>
                      <button
                        data-testid={`apk-delete-${r.version_code}`}
                        onClick={() => handleDeleteRelease(r.version_code)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {apkReleases.length === 0 && (
            <p className="text-gray-500 text-sm italic" data-testid="apk-no-releases">No APK releases uploaded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsTab;
