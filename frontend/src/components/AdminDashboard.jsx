import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Upload, Plus, Trash2, QrCode, CheckCircle, XCircle, Clock, Edit, RefreshCw, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import UserManagementTab from './UserManagementTab';
import SettingsTab from './SettingsTab';
import MediaLibraryTab from './MediaLibraryTab';
import VODTab from './VODTab';
import NotificationsTab from './NotificationsTab';
import CVRTab from './CVRTab';
import BrandingTab from './BrandingTab';
import AnalyticsTab from './AnalyticsTab';

// Shared category color map (keep in sync with EPGGrid)
const CATEGORY_COLORS = {
  entertainment: { accent: '#3a7fc4', badgeBg: '#0f1e2e', badgeText: '#7ab3d8', label: 'Entertainment' },
  movies:        { accent: '#b07a3a', badgeBg: '#2a1c0a', badgeText: '#c49050', label: 'Cinema'        },
  action:        { accent: '#c04a2a', badgeBg: '#2c100a', badgeText: '#d07050', label: 'Action'        },
  sports:        { accent: '#3a8f4a', badgeBg: '#0d2414', badgeText: '#72b07e', label: 'Sports'        },
  news:          { accent: '#a84040', badgeBg: '#280f0f', badgeText: '#c07272', label: 'News'          },
  kids:          { accent: '#a0a030', badgeBg: '#262610', badgeText: '#b8b052', label: 'Kids'          },
  music:         { accent: '#9a3a9a', badgeBg: '#250f25', badgeText: '#b87ab8', label: 'Music'         },
  nature:        { accent: '#349494', badgeBg: '#0c2828', badgeText: '#6aacac', label: 'Nature'        },
  tech:          { accent: '#3a5aa0', badgeBg: '#101828', badgeText: '#7090c0', label: 'Tech'          },
  drama:         { accent: '#7a3ab0', badgeBg: '#1c0d2e', badgeText: '#a470c4', label: 'Drama'         },
  lifestyle:     { accent: '#3a9470', badgeBg: '#0d261e', badgeText: '#68b094', label: 'Lifestyle'     },
  gaming:        { accent: '#8a5030', badgeBg: '#200f08', badgeText: '#aa7050', label: 'Gaming'        },
  family:        { accent: '#4a90c0', badgeBg: '#0f2030', badgeText: '#80b8d8', label: 'Family'        },
  sitcom:        { accent: '#5aaa6a', badgeBg: '#102818', badgeText: '#82c492', label: 'Sitcom'        },
  science:       { accent: '#2a8a9a', badgeBg: '#0a2428', badgeText: '#60b0b8', label: 'Science'       },
  gameshow:      { accent: '#c09030', badgeBg: '#2a200a', badgeText: '#d0a850', label: 'Gameshow'      },
  comedy:        { accent: '#d0803a', badgeBg: '#2c1c0a', badgeText: '#e0a060', label: 'Comedy'        },
  latenight:     { accent: '#505090', badgeBg: '#141428', badgeText: '#8080b0', label: 'Late Night'    },
  holiday:       { accent: '#c04040', badgeBg: '#2c0f0f', badgeText: '#d87070', label: 'Holiday'       },
  crime:         { accent: '#606060', badgeBg: '#1a1a1a', badgeText: '#909090', label: 'Crime'         },
};
const getCatColor = (cat) => CATEGORY_COLORS[cat] || CATEGORY_COLORS.entertainment;
import TicketsTab from './admin/TicketsTab';
import FAQTab from './admin/FAQTab';
import HomeFeedTab from './HomeFeedTab';
import CatalogTab from './CatalogTab';
import StorageWidget from './StorageWidget';
import SystemHealthWidget from './SystemHealthWidget';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { token, logout } = useAuth();
  const [channels, setChannels] = useState([]);
  const [devices, setDevices] = useState([]);
  const [programs, setPrograms] = useState([]);
  
  // Channel form
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [channelForm, setChannelForm] = useState({
    name: '',
    number: '',
    description: '',
    quality_label: '1080p',
    channel_type: 'live',
    stream_url: '',
    media_id: '',
    category: 'entertainment'
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');

  // Program form
  const [isProgramDialogOpen, setIsProgramDialogOpen] = useState(false);
  const [programForm, setProgramForm] = useState({
    channel_id: '',
    title: '',
    description: '',
    start_time: '',
    duration_minutes: 30,
    date: new Date().toISOString().split('T')[0],
    media_id: '',
    catalog_id: ''
  });
  const [mediaList, setMediaList] = useState([]);
  const [catalogList, setCatalogList] = useState([]);

  // Device form
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    device_name: '',
    mac_address: ''
  });
  
  // QR refresh dialog
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [qrDialogData, setQrDialogData] = useState(null);

  const getHeaders = () => ({ Authorization: `Bearer ${token}` });

  useEffect(() => {
    fetchChannels();
    fetchDevices();
    fetchPrograms();
    fetchMediaList();
    fetchCatalogList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchChannels = async () => {
    try {
      const response = await axios.get(`${API}/channels/admin/all`, { headers: getHeaders() });
      setChannels(response.data);
    } catch (error) {
      console.error('Error fetching channels:', error);
      toast.error('Failed to fetch channels');
    }
  };

  const fetchDevices = async () => {
    try {
      const response = await axios.get(`${API}/devices`, { headers: getHeaders() });
      setDevices(response.data);
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error('Failed to fetch devices');
    }
  };

  const fetchPrograms = async () => {
    try {
      const response = await axios.get(`${API}/programs`, { headers: getHeaders() });
      setPrograms(response.data);
    } catch (error) {
      console.error('Error fetching programs:', error);
      toast.error('Failed to fetch programs');
    }
  };

  const fetchMediaList = async () => {
    try {
      const response = await axios.get(`${API}/media`, { headers: getHeaders() });
      setMediaList(response.data);
    } catch (error) {
      console.error('Error fetching media list:', error);
    }
  };

  const fetchCatalogList = async () => {
    try {
      const response = await axios.get(`${API}/catalog`, { headers: getHeaders() });
      setCatalogList(response.data);
    } catch (error) {
      console.error('Error fetching catalog:', error);
    }
  };

  const handleMediaSelectForProgram = async (mediaId) => {
    if (!mediaId) {
      setProgramForm(f => ({ ...f, media_id: '' }));
      return;
    }
    setProgramForm(f => ({ ...f, media_id: mediaId }));
    try {
      const res = await axios.get(`${API}/programs/media/${mediaId}/info`, { headers: getHeaders() });
      setProgramForm(f => ({
        ...f,
        media_id: mediaId,
        title: f.title || res.data.title || '',
        description: f.description || res.data.description || '',
        duration_minutes: res.data.duration_minutes || f.duration_minutes,
      }));
    } catch (e) {
      console.error('Could not fetch media info', e);
    }
  };

  const handleCatalogSelectForProgram = (catalogId) => {
    if (!catalogId) {
      setProgramForm(f => ({ ...f, catalog_id: '' }));
      return;
    }
    const entry = catalogList.find(c => c.id === catalogId);
    if (entry) {
      setProgramForm(f => ({
        ...f,
        catalog_id: catalogId,
        title: f.title || entry.title || '',
        description: f.description || entry.description || '',
        duration_minutes: entry.runtime_minutes || f.duration_minutes,
      }));
    } else {
      setProgramForm(f => ({ ...f, catalog_id: catalogId }));
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    
    try {
      let logoPath = '';
      
      // Upload logo first if provided
      if (logoFile) {
        const formData = new FormData();
        formData.append('file', logoFile);
        
        const uploadResponse = await axios.post(`${API}/channels/upload-logo`, formData, {
          headers: {
            ...getHeaders(),
            'Content-Type': 'multipart/form-data'
          }
        });
        logoPath = uploadResponse.data.logo_path;
      }

      if (isEditMode && editingChannelId) {
        // Update existing channel
        await axios.put(`${API}/channels/${editingChannelId}`, {
          ...channelForm,
          ...(logoPath && { logo_path: logoPath })
        }, { headers: getHeaders() });
        toast.success('Channel updated successfully!');
      } else {
        // Create new channel
        await axios.post(`${API}/channels`, {
          ...channelForm,
          logo_path: logoPath
        }, { headers: getHeaders() });
        toast.success('Channel created successfully!');
      }

      setIsChannelDialogOpen(false);
      setIsEditMode(false);
      setEditingChannelId(null);
      setChannelForm({ name: '', number: '', description: '' });
      setLogoFile(null);
      setLogoPreview('');
      fetchChannels();
    } catch (error) {
      toast.error(isEditMode ? 'Failed to update channel' : 'Failed to create channel');
      console.error('Error with channel:', error);
    }
  };

  const handleEditChannel = (channel) => {
    setIsEditMode(true);
    setEditingChannelId(channel.id);
    setChannelForm({
      name: channel.name,
      number: channel.number,
      description: channel.description || '',
      quality_label: channel.quality_label || '1080p',
      channel_type: channel.channel_type || 'live',
      stream_url: channel.stream_url || '',
      media_id: channel.media_id || '',
      category: channel.category || 'entertainment'
    });
    setLogoPreview(channel.logo_path ? `${BACKEND_URL}/api${channel.logo_path}` : '');
    setIsChannelDialogOpen(true);
  };

  const handleAddNewChannel = () => {
    setIsEditMode(false);
    setEditingChannelId(null);
    setChannelForm({ name: '', number: '', description: '', quality_label: '1080p', channel_type: 'live', stream_url: '', media_id: '', category: 'entertainment' });
    setLogoFile(null);
    setLogoPreview('');
    setIsChannelDialogOpen(true);
  };

  const handleDeleteChannel = async (id) => {
    if (!window.confirm('Are you sure you want to delete this channel?')) return;
    
    try {
      await axios.delete(`${API}/channels/${id}`, { headers: getHeaders() });
      toast.success('Channel deleted successfully!');
      fetchChannels();
    } catch (error) {
      toast.error('Failed to delete channel');
      console.error('Error deleting channel:', error);
    }
  };

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/programs`, programForm, { headers: getHeaders() });
      toast.success('Program added successfully!');
      setIsProgramDialogOpen(false);
      setProgramForm({
        channel_id: '',
        title: '',
        description: '',
        start_time: '',
        duration_minutes: 30,
        date: new Date().toISOString().split('T')[0],
        media_id: '',
        catalog_id: ''
      });
      fetchPrograms();
    } catch (error) {
      toast.error('Failed to add program');
      console.error('Error creating program:', error);
    }
  };

  const handleDeleteProgram = async (id) => {
    if (!window.confirm('Are you sure you want to delete this program?')) return;
    
    try {
      await axios.delete(`${API}/programs/${id}`, { headers: getHeaders() });
      toast.success('Program deleted successfully!');
      fetchPrograms();
    } catch (error) {
      toast.error('Failed to delete program');
      console.error('Error deleting program:', error);
    }
  };

  const handleCreateDevice = async (e) => {
    e.preventDefault();
    
    try {
      await axios.post(`${API}/devices`, deviceForm, { headers: getHeaders() });
      toast.success('Device created with activation code!');
      setIsDeviceDialogOpen(false);
      setDeviceForm({ device_name: '', mac_address: '' });
      fetchDevices();
    } catch (error) {
      toast.error('Failed to create device');
      console.error('Error creating device:', error);
    }
  };
  
  const handleRefreshQR = async (deviceId, resetCode = false) => {
    try {
      const response = await axios.post(
        `${API}/devices/refresh-qr`,
        null,
        {
          params: { device_id: deviceId, reset_code: resetCode },
          headers: getHeaders()
        }
      );
      
      setQrDialogData({
        ...response.data,
        device_id: deviceId,
        action: resetCode ? 'reset' : 'refresh'
      });
      setIsQRDialogOpen(true);
      
      toast.success(resetCode ? 'QR code and activation code reset!' : 'QR code refreshed!');
      fetchDevices();
    } catch (error) {
      toast.error('Failed to refresh QR code');
      console.error('Error refreshing QR:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'deactivated':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'suspended':
        return <XCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-6 pl-26">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
          <div className="flex items-center gap-3">
            <a
              href={`http://${window.location.hostname}:9000`}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="docker-manager-btn"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-200 border border-gray-600 hover:bg-[#0056A8] hover:border-[#0056A8] transition-all"
              style={{ background: '#2a2a2a' }}
              title="Open Portainer Docker Manager"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="8" height="8" rx="1"/><rect x="14" y="2" width="8" height="8" rx="1"/><rect x="2" y="14" width="8" height="8" rx="1"/><rect x="14" y="14" width="8" height="8" rx="1"/>
              </svg>
              Docker Manager
            </a>
            <Button onClick={logout} variant="outline" className="bg-transparent border-gray-600 text-white">
              Logout
            </Button>
          </div>
        </div>

        <Tabs defaultValue="channels" className="w-full" data-testid="admin-tabs">
          <TabsList className="bg-[#2a2a2a] border-gray-700 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="channels" className="data-[state=active]:bg-[#0056A8]" data-testid="channels-tab-trigger">Channels</TabsTrigger>
            <TabsTrigger value="programs" className="data-[state=active]:bg-[#0056A8]" data-testid="programs-tab-trigger">EPG Programs</TabsTrigger>
            <TabsTrigger value="media" className="data-[state=active]:bg-[#0056A8]" data-testid="media-tab-trigger">Media Library</TabsTrigger>
            <TabsTrigger value="vod" className="data-[state=active]:bg-[#0056A8]" data-testid="vod-tab-trigger">VOD</TabsTrigger>
            <TabsTrigger value="devices" className="data-[state=active]:bg-[#0056A8]" data-testid="devices-tab-trigger">Devices</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-[#0056A8]" data-testid="users-tab-trigger">Users</TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-[#0056A8]" data-testid="notifications-tab-trigger">Notifications</TabsTrigger>
            <TabsTrigger value="cvr" className="data-[state=active]:bg-[#0056A8]" data-testid="cvr-tab-trigger">CVR</TabsTrigger>
            <TabsTrigger value="tickets" className="data-[state=active]:bg-[#0056A8]" data-testid="tickets-tab-trigger">Support Tickets</TabsTrigger>
            <TabsTrigger value="faq" className="data-[state=active]:bg-[#0056A8]" data-testid="faq-tab-trigger">FAQ</TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-[#0056A8]" data-testid="stats-tab-trigger">Statistics</TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-[#0056A8]" data-testid="system-tab-trigger">System Health</TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-[#0056A8]" data-testid="analytics-tab-trigger">Analytics</TabsTrigger>
            <TabsTrigger value="branding" className="data-[state=active]:bg-[#0056A8]" data-testid="branding-tab-trigger">Branding</TabsTrigger>
            <TabsTrigger value="catalog" className="data-[state=active]:bg-[#0056A8]" data-testid="catalog-tab-trigger">Media Catalog</TabsTrigger>
            <TabsTrigger value="home-feed" className="data-[state=active]:bg-[#0056A8]" data-testid="home-feed-tab-trigger">Home Feed</TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-[#0056A8]" data-testid="settings-tab-trigger">Settings</TabsTrigger>
          </TabsList>

          {/* Channels Tab */}
          <TabsContent value="channels" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-white">Channel Management</h2>
              <Button
                onClick={handleAddNewChannel}
                className="bg-[#0056A8] hover:bg-[#0066c8]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Channel
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {channels.map((channel) => (
                <Card key={channel.id} className="bg-[#2a2a2a] border-gray-700">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={channel.logo_path ? `${BACKEND_URL}/api${channel.logo_path}` : ''}
                          alt={channel.name}
                          className="w-16 h-16 rounded-md object-cover"
                          onError={(e) => {
                            e.target.src = `data:image/svg+xml;charset=utf-8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><rect width='80' height='80' fill='%230056A8'/><text x='40' y='45' font-family='Arial' font-size='14' fill='white' text-anchor='middle'>${channel.number}</text></svg>`;
                          }}
                        />
                        <div>
                          <CardTitle className="text-white text-lg">{channel.name}</CardTitle>
                          <CardDescription className="text-gray-400 flex items-center gap-2">
                            Ch {channel.number}
                            {channel.category && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                style={{ background: getCatColor(channel.category).badgeBg, color: getCatColor(channel.category).badgeText }}>
                                {getCatColor(channel.category).label}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditChannel(channel)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteChannel(channel.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300 text-sm">{channel.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Programs Tab */}
          <TabsContent value="programs" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-white">EPG Program Management</h2>
              <Button
                onClick={() => setIsProgramDialogOpen(true)}
                className="bg-[#0056A8] hover:bg-[#0066c8]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Program
              </Button>
            </div>

            <Card className="bg-[#2a2a2a] border-gray-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#1a1a1a]">
                      <tr>
                        <th className="text-left p-3 text-gray-300">Channel</th>
                        <th className="text-left p-3 text-gray-300">Title</th>
                        <th className="text-left p-3 text-gray-300">Date</th>
                        <th className="text-left p-3 text-gray-300">Time</th>
                        <th className="text-left p-3 text-gray-300">Duration</th>
                        <th className="text-right p-3 text-gray-300">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {programs.map((program) => {
                        const channel = channels.find(c => c.id === program.channel_id);
                        return (
                          <tr key={program.id} className="border-t border-gray-700">
                            <td className="p-3 text-white">{channel?.name || 'Unknown'}</td>
                            <td className="p-3 text-white">{program.title}</td>
                            <td className="p-3 text-gray-400">{program.date}</td>
                            <td className="p-3 text-gray-400">{program.start_time}</td>
                            <td className="p-3 text-gray-400">{program.duration_minutes} min</td>
                            <td className="p-3 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteProgram(program.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Devices Tab */}
          <TabsContent value="devices" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-white">Device Management</h2>
              <Button
                onClick={() => setIsDeviceDialogOpen(true)}
                className="bg-[#0056A8] hover:bg-[#0066c8]"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Device
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {devices.map((device) => (
                <Card key={device.id} className="bg-[#2a2a2a] border-gray-700">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          {device.device_name}
                          {getStatusIcon(device.status)}
                        </CardTitle>
                        <CardDescription className="text-gray-400 mt-1">
                          MAC: {device.mac_address}
                        </CardDescription>
                        <CardDescription className="text-gray-400 text-xs mt-1">
                          UUID: {device.device_uuid}
                        </CardDescription>
                      </div>
                      {device.qr_code_path && (
                        <img
                          src={`${BACKEND_URL}/api${device.qr_code_path}`}
                          alt="QR Code"
                          className="w-20 h-20"
                        />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="bg-[#1a1a1a] p-3 rounded">
                      <p className="text-xs text-gray-400 mb-1">Activation Code:</p>
                      <code className="text-white text-sm font-mono">{device.activation_code}</code>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Status:</p>
                        <p className="text-white capitalize">{device.status}</p>
                      </div>
                      {device.user_id && (
                        <div>
                          <p className="text-gray-400">User ID:</p>
                          <p className="text-blue-300 font-mono text-xs">{device.user_id}</p>
                        </div>
                      )}
                      {device.current_ip && (
                        <div>
                          <p className="text-gray-400">Public IP:</p>
                          <div className="flex items-center gap-1">
                            <p className="text-white font-mono text-xs">{device.current_ip}</p>
                            <span className={`text-xs px-1 py-0.5 rounded ${
                              (() => {
                                const hist = device.ip_history || [];
                                const uniqueIPs = [...new Set(hist.map(h => h.ip))];
                                if (uniqueIPs.length === 1 && hist.length >= 3) return 'bg-green-900/50 text-green-400';
                                if (uniqueIPs.length > 1) return 'bg-orange-900/50 text-orange-400';
                                return 'bg-gray-700 text-gray-400';
                              })()
                            }`}>
                              {(() => {
                                const hist = device.ip_history || [];
                                const uniqueIPs = [...new Set(hist.map(h => h.ip))];
                                if (uniqueIPs.length === 1 && hist.length >= 3) return 'Static';
                                if (uniqueIPs.length > 1) return 'Dynamic';
                                return '?';
                              })()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {device.last_geo_check && (
                      <div className="bg-[#1a1a1a] p-2 rounded">
                        <p className="text-xs text-gray-400">Location:</p>
                        <p className="text-white text-xs font-medium">
                          {[device.last_geo_check.city, device.last_geo_check.region, device.last_geo_check.country]
                            .filter(Boolean).join(', ')}
                        </p>
                        {device.last_geo_check.isp && (
                          <p className="text-gray-400 text-xs">ISP: {device.last_geo_check.isp}</p>
                        )}
                      </div>
                    )}
                    
                    {device.activated_at && (
                      <p className="text-xs text-gray-400">
                        Activated: {new Date(device.activated_at).toLocaleString()}
                      </p>
                    )}
                    
                    {device.last_access && (
                      <p className="text-xs text-gray-400">
                        Last Access: {new Date(device.last_access).toLocaleString()}
                      </p>
                    )}
                    
                    {device.ip_history && device.ip_history.length > 0 && (
                      <div className="text-xs text-gray-400">
                        IP History: {device.ip_history.length} entries
                      </div>
                    )}
                    
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleRefreshQR(device.id, false)}
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Refresh QR
                      </Button>
                      <Button
                        onClick={() => handleRefreshQR(device.id, true)}
                        size="sm"
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Reset Code
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" data-testid="users-tab-content">
            <UserManagementTab token={token} />
          </TabsContent>


          {/* Media Library Tab */}
          <TabsContent value="media">
            <MediaLibraryTab token={token} />
          </TabsContent>

          {/* VOD Tab */}
          <TabsContent value="vod">
            <VODTab token={token} />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications">
            <NotificationsTab token={token} />
          </TabsContent>

          {/* CVR Tab */}
          <TabsContent value="cvr">
            <CVRTab token={token} />
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets">
            <TicketsTab token={token} />
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq">
            <FAQTab token={token} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <AnalyticsTab token={token} />
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding">
            <BrandingTab token={token} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <SettingsTab token={token} />
          </TabsContent>

          {/* Home Feed Tab */}
          <TabsContent value="home-feed">
            <HomeFeedTab token={token} />
          </TabsContent>

          {/* Media Catalog Tab */}
          <TabsContent value="catalog">
            <CatalogTab token={token} />
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-6">
            <h2 className="text-2xl font-semibold text-white mb-2">System Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-[#2a2a2a] border-gray-700">
                <CardHeader><CardTitle className="text-white">Total Channels</CardTitle></CardHeader>
                <CardContent><p className="text-4xl font-bold text-[#0056A8]">{channels.length}</p></CardContent>
              </Card>
              <Card className="bg-[#2a2a2a] border-gray-700">
                <CardHeader><CardTitle className="text-white">Total Programs</CardTitle></CardHeader>
                <CardContent><p className="text-4xl font-bold text-[#0056A8]">{programs.length}</p></CardContent>
              </Card>
              <Card className="bg-[#2a2a2a] border-gray-700">
                <CardHeader><CardTitle className="text-white">Active Devices</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-[#0056A8]">{devices.filter(d => d.status === 'active').length}</p>
                </CardContent>
              </Card>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Storage</h3>
              <StorageWidget token={token} />
            </div>
          </TabsContent>

          {/* System Health Tab */}
          <TabsContent value="system" className="space-y-6">
            <h2 className="text-2xl font-semibold text-white mb-2">System Health</h2>
            <SystemHealthWidget token={token} />
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Storage Breakdown</h3>
              <StorageWidget token={token} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Channel Dialog */}
        <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
          <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl text-white">
                {isEditMode ? 'Edit Channel' : 'Add New Channel'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateChannel} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-white">Channel Name *</Label>
                <Input
                  id="name"
                  value={channelForm.name}
                  onChange={(e) => setChannelForm({...channelForm, name: e.target.value})}
                  placeholder="e.g., Premium Movies HD"
                  required
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="number" className="text-white">Channel Number *</Label>
                <Input
                  id="number"
                  value={channelForm.number}
                  onChange={(e) => setChannelForm({...channelForm, number: e.target.value})}
                  placeholder="e.g., 1305"
                  required
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-white">Description</Label>
                <Textarea
                  id="description"
                  value={channelForm.description}
                  onChange={(e) => setChannelForm({...channelForm, description: e.target.value})}
                  placeholder="Brief description of the channel"
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="logo" className="text-white">Channel Logo</Label>
                <div className="flex items-center gap-4">
                  <label htmlFor="logo"
                    className="flex items-center gap-2 px-4 py-2 bg-[#0056A8] hover:bg-[#0066c8] text-white rounded-lg cursor-pointer transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>Upload Logo</span>
                  </label>
                  <input id="logo" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  {logoPreview && <img src={logoPreview} alt="Preview" className="w-20 h-20 rounded border-2 border-gray-600" />}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white">Quality Label</Label>
                  <select
                    value={channelForm.quality_label || '1080p'}
                    onChange={(e) => setChannelForm({ ...channelForm, quality_label: e.target.value })}
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white"
                  >
                    {['720p', '720p60', '1080p', '1080p60', '1440p', '1440p60', '4K', '4K60'].map(q => (
                      <option key={q} value={q}>{q}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white">Channel Type</Label>
                  <select
                    value={channelForm.channel_type || 'live'}
                    onChange={(e) => setChannelForm({ ...channelForm, channel_type: e.target.value })}
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white"
                  >
                    <option value="live">Live TV</option>
                    <option value="vod">VOD Channel</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Media File (the video that plays when this channel is selected)</Label>
                <select
                  value={channelForm.media_id || ''}
                  onChange={(e) => setChannelForm({ ...channelForm, media_id: e.target.value })}
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white text-sm"
                  data-testid="channel-media-select"
                >
                  <option value="">— No file linked yet —</option>
                  {mediaList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.duration_formatted || 'no duration'}) [{m.quality_label || '?'}]
                    </option>
                  ))}
                </select>
                {channelForm.media_id && (
                  <p className="text-green-400 text-xs mt-1">
                    File linked — clicking this channel will play it immediately.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-white">Category (sets EPG color coding)</Label>
                <select
                  value={channelForm.category || 'entertainment'}
                  onChange={(e) => setChannelForm({ ...channelForm, category: e.target.value })}
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white text-sm"
                  data-testid="channel-category-select"
                >
                  <option value="entertainment">Entertainment</option>
                  <option value="movies">Cinema / Movies</option>
                  <option value="sports">Sports</option>
                  <option value="news">News</option>
                  <option value="kids">Kids</option>
                  <option value="music">Music</option>
                  <option value="nature">Nature / Science</option>
                  <option value="tech">Tech / Gaming Adjacent</option>
                  <option value="drama">Drama</option>
                  <option value="lifestyle">Lifestyle / Travel</option>
                  <option value="gaming">Gaming / Esports</option>
                </select>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => setIsChannelDialogOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#0056A8] hover:bg-[#0066c8]">
                  {isEditMode ? 'Update Channel' : 'Add Channel'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Program Dialog */}
        <Dialog open={isProgramDialogOpen} onOpenChange={setIsProgramDialogOpen}>
          <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl text-white">Add Program to EPG</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateProgram} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-white text-sm font-medium">Link Catalog Entry (auto-fills title, description & duration)</Label>
                <select
                  value={programForm.catalog_id || ''}
                  onChange={(e) => handleCatalogSelectForProgram(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white text-sm"
                  data-testid="program-catalog-select"
                >
                  <option value="">— No catalog entry (manual entry) —</option>
                  {catalogList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.content_type?.replace(/_/g, ' ')}) {c.release_date ? `[${c.release_date.slice(0,4)}]` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-white text-sm font-medium">Link Media File (auto-fills title, description & duration)</Label>
                <select
                  value={programForm.media_id || ''}
                  onChange={(e) => handleMediaSelectForProgram(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white text-sm"
                >
                  <option value="">— No media file (manual entry) —</option>
                  {mediaList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.duration_formatted || 'no duration'}) [{m.quality_label || '?'}]
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="channel" className="text-white">Channel *</Label>
                <select
                  id="channel"
                  value={programForm.channel_id}
                  onChange={(e) => setProgramForm({...programForm, channel_id: e.target.value})}
                  required
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white"
                >
                  <option value="">Select a channel</option>
                  {channels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {channel.number} - {channel.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="title" className="text-white">Program Title *</Label>
                <Input
                  id="title"
                  value={programForm.title}
                  onChange={(e) => setProgramForm({...programForm, title: e.target.value})}
                  placeholder="e.g., Action Movie Marathon"
                  required
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-white">Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={programForm.date}
                    onChange={(e) => setProgramForm({...programForm, date: e.target.value})}
                    required
                    className="bg-[#2a2a2a] border-gray-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_time" className="text-white">Start Time *</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={programForm.start_time}
                    onChange={(e) => setProgramForm({...programForm, start_time: e.target.value})}
                    required
                    className="bg-[#2a2a2a] border-gray-600 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration" className="text-white">Duration (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min="30"
                  step="30"
                  value={programForm.duration_minutes}
                  onChange={(e) => setProgramForm({...programForm, duration_minutes: parseInt(e.target.value)})}
                  required
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prog_description" className="text-white">Description</Label>
                <Textarea
                  id="prog_description"
                  value={programForm.description}
                  onChange={(e) => setProgramForm({...programForm, description: e.target.value})}
                  placeholder="Brief description of the program"
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => setIsProgramDialogOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#0056A8] hover:bg-[#0066c8]">
                  Add Program
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Device Dialog */}
        <Dialog open={isDeviceDialogOpen} onOpenChange={setIsDeviceDialogOpen}>
          <DialogContent className="bg-[#1a1a1a] border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-2xl text-white">Add New Device</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateDevice} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="device_name" className="text-white">Device Name *</Label>
                <Input
                  id="device_name"
                  value={deviceForm.device_name}
                  onChange={(e) => setDeviceForm({...deviceForm, device_name: e.target.value})}
                  placeholder="e.g., Living Room Box"
                  required
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mac_address" className="text-white">MAC Address *</Label>
                <Input
                  id="mac_address"
                  value={deviceForm.mac_address}
                  onChange={(e) => setDeviceForm({...deviceForm, mac_address: e.target.value})}
                  placeholder="e.g., 00:1B:44:11:3A:B7"
                  required
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => setIsDeviceDialogOpen(false)}
                  className="bg-gray-600 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-[#0056A8] hover:bg-[#0066c8]">
                  Generate Activation
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* QR Refresh Dialog */}
        <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
          <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl text-white">
                {qrDialogData?.action === 'reset' ? 'QR Code Reset' : 'QR Code Refreshed'}
              </DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {qrDialogData?.qr_code_path && (
                <div className="flex justify-center">
                  <img
                    src={`${BACKEND_URL}/api${qrDialogData.qr_code_path}`}
                    alt="Device QR Code"
                    className="w-64 h-64"
                  />
                </div>
              )}
              <div className="bg-[#2a2a2a] p-4 rounded">
                <p className="text-xs text-gray-400 mb-1">Activation Code:</p>
                <code className="text-white text-lg font-mono block text-center">
                  {qrDialogData?.activation_code}
                </code>
              </div>
              <p className="text-sm text-gray-400 text-center">
                {qrDialogData?.action === 'reset' 
                  ? 'New activation code generated. Previous code is now invalid.'
                  : 'QR code regenerated with the same activation code.'}
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => setIsQRDialogOpen(false)}
                className="bg-[#0056A8] hover:bg-[#0066c8] w-full"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default AdminDashboard;
