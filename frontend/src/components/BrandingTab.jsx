import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Upload, CheckCircle, Image, Shield, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useService } from '../contexts/ServiceContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const BrandingTab = ({ token }) => {
  const { serviceName, updateServiceName } = useService();
  const [serviceCfg, setServiceCfg] = useState({ service_name: serviceName || '' });
  const [currentLogo, setCurrentLogo] = useState(null);
  const [masterPin, setMasterPin] = useState({ current: '', new: '', confirm: '' });
  const [pinSaved, setPinSaved] = useState(false);
  const logoInputRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API}/setup/config`);
        setServiceCfg({ service_name: res.data.service_name || '' });
        if (res.data.logo_path) setCurrentLogo(res.data.logo_path);
      } catch (e) {}
    };
    load();
  }, []);

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Only image files (.png, .jpg) are supported');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/setup/upload-logo`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      setCurrentLogo(res.data.logo_path);
      toast.success('Service logo updated successfully');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Logo upload failed');
    } finally {
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleSaveServiceName = async () => {
    if (!serviceCfg.service_name.trim()) return toast.error('Service name cannot be empty');
    try {
      await axios.post(`${API}/setup/service-config`,
        null,
        { headers, params: { service_name: serviceCfg.service_name } }
      );
      updateServiceName(serviceCfg.service_name);
      localStorage.setItem('service_name', serviceCfg.service_name);
      toast.success(`Service name updated to "${serviceCfg.service_name}"`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save service name');
    }
  };

  const handleSaveMasterPin = async () => {
    if (!masterPin.new || masterPin.new.length < 4) return toast.error('PIN must be at least 4 characters');
    if (masterPin.new !== masterPin.confirm) return toast.error('PINs do not match');
    try {
      await axios.post(`${API}/auth/master-pin`, { current_pin: masterPin.current, new_pin: masterPin.new }, { headers });
      toast.success('Master admin PIN updated');
      setPinSaved(true);
      setMasterPin({ current: '', new: '', confirm: '' });
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update PIN — check current PIN');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Branding & System</h2>
        <p className="text-gray-400 text-sm mt-1">Service identity, logo, and admin security settings</p>
      </div>

      {/* Service Logo */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Image className="w-5 h-5 text-[#0056A8]" /> Service Logo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 bg-[#3a3a3a] rounded-xl flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-600">
              {currentLogo ? (
                <img src={`${BACKEND_URL}/api${currentLogo}`} alt="Service Logo" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="text-center">
                  <Image className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">No logo</p>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-gray-300 text-sm">Upload a PNG or JPG logo. Recommended: 512x512px or larger, transparent background (PNG).</p>
              <input ref={logoInputRef} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={handleLogoUpload} />
              <Button onClick={() => logoInputRef.current?.click()} className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="upload-logo-btn">
                <Upload className="w-4 h-4 mr-2" /> Upload Logo (.png / .jpg)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Name */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Service Name</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-white">Display Name (shown in the guide and all apps)</Label>
            <div className="flex gap-3">
              <Input
                value={serviceCfg.service_name}
                onChange={(e) => setServiceCfg({ ...serviceCfg, service_name: e.target.value })}
                placeholder="My IPTV Service"
                className="bg-[#3a3a3a] border-gray-600 text-white flex-1"
                data-testid="service-name-input"
              />
              <Button onClick={handleSaveServiceName} className="bg-[#0056A8] hover:bg-[#0066c8]">Save</Button>
            </div>
          </div>
          <p className="text-gray-500 text-sm">Current live name: <span className="text-white font-medium">{serviceName}</span></p>
        </CardContent>
      </Card>

      {/* Master Admin PIN */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0056A8]" /> Master Admin PIN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400 text-sm">This PIN locks sensitive sidebar settings on the TV guide from regular users. Only you should know this PIN.</p>
          {pinSaved && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" /> PIN set successfully
            </div>
          )}
          <div className="space-y-3">
            <div><Label className="text-white text-sm">Current PIN (leave blank if first time)</Label>
              <Input type="password" value={masterPin.current} onChange={(e) => setMasterPin({ ...masterPin, current: e.target.value })}
                placeholder="Current PIN" className="bg-[#3a3a3a] border-gray-600 text-white mt-1" /></div>
            <div><Label className="text-white text-sm">New PIN (min. 4 characters)</Label>
              <Input type="password" value={masterPin.new} onChange={(e) => setMasterPin({ ...masterPin, new: e.target.value })}
                placeholder="New PIN" className="bg-[#3a3a3a] border-gray-600 text-white mt-1" /></div>
            <div><Label className="text-white text-sm">Confirm New PIN</Label>
              <Input type="password" value={masterPin.confirm} onChange={(e) => setMasterPin({ ...masterPin, confirm: e.target.value })}
                placeholder="Confirm PIN" className="bg-[#3a3a3a] border-gray-600 text-white mt-1" /></div>
          </div>
          <Button onClick={handleSaveMasterPin} className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="save-pin-btn">
            <KeyRound className="w-4 h-4 mr-2" /> Set Master PIN
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default BrandingTab;
