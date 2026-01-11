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
import { Upload, Plus, Trash2, QrCode, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { token, logout } = useAuth();
  const [channels, setChannels] = useState([]);
  const [devices, setDevices] = useState([]);
  const [programs, setPrograms] = useState([]);
  
  // Channel form
  const [isChannelDialogOpen, setIsChannelDialogOpen] = useState(false);
  const [channelForm, setChannelForm] = useState({
    name: '',
    number: '',
    description: ''
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
    date: new Date().toISOString().split('T')[0]
  });

  // Device form
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    device_name: '',
    mac_address: ''
  });

  const getHeaders = () => ({ Authorization: `Bearer ${token}` });

  useEffect(() => {
    fetchChannels();
    fetchDevices();
    fetchPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchChannels = async () => {
    try {
      const response = await axios.get(`${API}/channels`, { headers: getHeaders() });
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
            ...headers,
            'Content-Type': 'multipart/form-data'
          }
        });
        logoPath = uploadResponse.data.logo_path;
      }

      // Create channel
      await axios.post(`${API}/channels`, {
        ...channelForm,
        logo_path: logoPath
      }, { headers });

      toast.success('Channel created successfully!');
      setIsChannelDialogOpen(false);
      setChannelForm({ name: '', number: '', description: '' });
      setLogoFile(null);
      setLogoPreview('');
      fetchChannels();
    } catch (error) {
      toast.error('Failed to create channel');
      console.error('Error creating channel:', error);
    }
  };

  const handleDeleteChannel = async (id) => {
    if (!window.confirm('Are you sure you want to delete this channel?')) return;
    
    try {
      await axios.delete(`${API}/channels/${id}`, { headers });
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
      await axios.post(`${API}/programs`, programForm, { headers });
      toast.success('Program added successfully!');
      setIsProgramDialogOpen(false);
      setProgramForm({
        channel_id: '',
        title: '',
        description: '',
        start_time: '',
        duration_minutes: 30,
        date: new Date().toISOString().split('T')[0]
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
      await axios.delete(`${API}/programs/${id}`, { headers });
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
      await axios.post(`${API}/devices`, deviceForm, { headers });
      toast.success('Device created with activation code!');
      setIsDeviceDialogOpen(false);
      setDeviceForm({ device_name: '', mac_address: '' });
      fetchDevices();
    } catch (error) {
      toast.error('Failed to create device');
      console.error('Error creating device:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'deactivated':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-6 pl-26">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold text-white">Admin Dashboard</h1>
          <Button onClick={logout} variant="outline" className="bg-transparent border-gray-600 text-white">
            Logout
          </Button>
        </div>

        <Tabs defaultValue="channels" className="w-full">
          <TabsList className="bg-[#2a2a2a] border-gray-700">
            <TabsTrigger value="channels" className="data-[state=active]:bg-[#0056A8]">
              Channels
            </TabsTrigger>
            <TabsTrigger value="programs" className="data-[state=active]:bg-[#0056A8]">
              EPG Programs
            </TabsTrigger>
            <TabsTrigger value="devices" className="data-[state=active]:bg-[#0056A8]">
              Devices
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-[#0056A8]">
              Statistics
            </TabsTrigger>
          </TabsList>

          {/* Channels Tab */}
          <TabsContent value="channels" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-semibold text-white">Channel Management</h2>
              <Button
                onClick={() => setIsChannelDialogOpen(true)}
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
                          src={`${BACKEND_URL}${channel.logo_path}` || 'https://via.placeholder.com/80'}
                          alt={channel.name}
                          className="w-16 h-16 rounded-md object-cover"
                        />
                        <div>
                          <CardTitle className="text-white text-lg">{channel.name}</CardTitle>
                          <CardDescription className="text-gray-400">Ch {channel.number}</CardDescription>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteChannel(channel.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
                      <div>
                        <CardTitle className="text-white text-lg flex items-center gap-2">
                          {device.device_name}
                          {getStatusIcon(device.status)}
                        </CardTitle>
                        <CardDescription className="text-gray-400">{device.mac_address}</CardDescription>
                      </div>
                      {device.qr_code_path && (
                        <img
                          src={`${BACKEND_URL}${device.qr_code_path}`}
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
                    <p className="text-xs text-gray-400">
                      Status: <span className="text-white capitalize">{device.status}</span>
                    </p>
                    {device.activated_at && (
                      <p className="text-xs text-gray-400">
                        Activated: {new Date(device.activated_at).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Statistics Tab */}
          <TabsContent value="stats" className="space-y-4">
            <h2 className="text-2xl font-semibold text-white mb-4">System Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-[#2a2a2a] border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Total Channels</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-[#0056A8]">{channels.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-[#2a2a2a] border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Total Programs</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-[#0056A8]">{programs.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-[#2a2a2a] border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Active Devices</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-4xl font-bold text-[#0056A8]">
                    {devices.filter(d => d.status === 'active').length}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Channel Dialog */}
        <Dialog open={isChannelDialogOpen} onOpenChange={setIsChannelDialogOpen}>
          <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-2xl text-white">Add New Channel</DialogTitle>
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
                  <label
                    htmlFor="logo"
                    className="flex items-center gap-2 px-4 py-2 bg-[#0056A8] hover:bg-[#0066c8] text-white rounded-lg cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Logo</span>
                  </label>
                  <input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  {logoPreview && (
                    <img src={logoPreview} alt="Preview" className="w-20 h-20 rounded border-2 border-gray-600" />
                  )}
                </div>
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
                  Add Channel
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
      </div>
    </div>
  );
};

export default AdminDashboard;
