import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Trash2, Edit, Plus, Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NOTIF_TYPES = ['movie', 'tv_show', 'mini_series', 'limited_series', 'system'];

const typeColors = { movie: 'bg-blue-600', tv_show: 'bg-green-600', mini_series: 'bg-purple-600', limited_series: 'bg-red-600', system: 'bg-gray-600' };
const typeLabels = { movie: 'Movie', tv_show: 'TV Show', mini_series: 'Mini Series', limited_series: 'Limited Series', system: 'System' };

const NotificationsTab = ({ token }) => {
  const [notifications, setNotifications] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', message: '', type: 'system', channel_id: '', channel_name: '' });
  const [filterType, setFilterType] = useState('all');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = async () => {
    try {
      const [notifRes, chanRes] = await Promise.all([
        axios.get(`${API}/notifications`, { params: { active_only: false } }),
        axios.get(`${API}/channels`)
      ]);
      setNotifications(notifRes.data);
      setChannels(chanRes.data);
    } catch (e) {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ title: '', message: '', type: 'system', channel_id: '', channel_name: '' });
    setIsDialogOpen(true);
  };

  const openEdit = (notif) => {
    setEditingId(notif.id);
    setForm({ title: notif.title, message: notif.message, type: notif.type, channel_id: notif.channel_id || '', channel_name: notif.channel_name || '' });
    setIsDialogOpen(true);
  };

  const handleChannelSelect = (channelId) => {
    const ch = channels.find(c => c.id === channelId);
    setForm(f => ({ ...f, channel_id: channelId, channel_name: ch?.name || '' }));
  };

  const handleSave = async () => {
    if (!form.title || !form.message) return toast.error('Title and message are required');
    const payload = { ...form, channel_id: form.channel_id || undefined };
    try {
      if (editingId) {
        await axios.put(`${API}/notifications/${editingId}`, payload, { headers });
        toast.success('Notification updated');
      } else {
        await axios.post(`${API}/notifications`, payload, { headers });
        toast.success('Notification created');
      }
      setIsDialogOpen(false);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      await axios.put(`${API}/notifications/${id}`, { is_active: !currentActive }, { headers });
      toast.success(currentActive ? 'Notification deactivated' : 'Notification activated');
      fetchAll();
    } catch (e) { toast.error('Update failed'); }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete notification "${title}"?`)) return;
    try {
      await axios.delete(`${API}/notifications/${id}`, { headers });
      toast.success('Notification deleted');
      fetchAll();
    } catch (e) { toast.error('Delete failed'); }
  };

  const filtered = filterType === 'all' ? notifications : notifications.filter(n => n.type === filterType);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Notifications</h2>
          <p className="text-gray-400 text-sm mt-1">Push notifications to all users on the guide — Movies, TV Shows, Mini Series & more</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2 text-sm">
            <option value="all">All Types</option>
            {NOTIF_TYPES.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
          </select>
          <Button onClick={openAdd} className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="add-notification-btn">
            <Plus className="w-4 h-4 mr-2" /> Add Notification
          </Button>
        </div>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : filtered.length === 0 ? (
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardContent className="py-16 text-center">
            <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No notifications yet</p>
            <p className="text-gray-500 text-sm mt-2">Create your first notification to alert users about new content</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((notif) => (
            <Card key={notif.id} className={`border ${notif.is_active ? 'bg-[#2a2a2a] border-gray-700' : 'bg-[#1f1f1f] border-gray-800 opacity-60'}`} data-testid={`notification-${notif.id}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notif.is_active ? 'bg-[#0056A8]' : 'bg-gray-700'}`}>
                  {notif.is_active ? <Bell className="w-5 h-5 text-white" /> : <BellOff className="w-5 h-5 text-gray-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-white font-semibold truncate">{notif.title}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs text-white ${typeColors[notif.type] || 'bg-gray-600'}`}>{typeLabels[notif.type]}</span>
                    {notif.channel_name && <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">{notif.channel_name}</span>}
                  </div>
                  <p className="text-gray-400 text-sm truncate">{notif.message}</p>
                  <p className="text-gray-600 text-xs mt-1">{new Date(notif.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch checked={notif.is_active} onCheckedChange={() => handleToggleActive(notif.id, notif.is_active)} />
                  <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    onClick={() => openEdit(notif)}><Edit className="w-3 h-3" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(notif.id, notif.title)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{editingId ? 'Edit Notification' : 'New Notification'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-white text-sm">Type</Label>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full mt-1 bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2 text-sm">
                  {NOTIF_TYPES.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
                </select>
              </div>
              <div><Label className="text-white text-sm">Related Channel</Label>
                <select value={form.channel_id} onChange={(e) => handleChannelSelect(e.target.value)}
                  className="w-full mt-1 bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2 text-sm">
                  <option value="">— None —</option>
                  {channels.map(c => <option key={c.id} value={c.id}>{c.number} - {c.name}</option>)}
                </select>
              </div>
            </div>
            <div><Label className="text-white text-sm">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="New movie now available!" className="bg-[#2a2a2a] border-gray-600 text-white mt-1" /></div>
            <div><Label className="text-white text-sm">Message *</Label>
              <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Full notification message..." className="bg-[#2a2a2a] border-gray-600 text-white mt-1 min-h-24" /></div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsDialogOpen(false)} className="bg-gray-600 hover:bg-gray-700">Cancel</Button>
            <Button onClick={handleSave} className="bg-[#0056A8] hover:bg-[#0066c8]">{editingId ? 'Update' : 'Send Notification'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NotificationsTab;
