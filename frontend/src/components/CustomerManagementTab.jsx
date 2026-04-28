import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Users, Plus, RefreshCw, KeyRound, MapPin, Trash2, Ban, CheckCircle, XCircle, Loader2, Copy, Eye, EyeOff, Globe } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CustomerManagementTab = ({ token }) => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCredentials, setShowCredentials] = useState(null);
  const [showLocation, setShowLocation] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [createForm, setCreateForm] = useState({ first_name: '', last_name: '', email: '' });
  const [creating, setCreating] = useState(false);
  const [newCredentials, setNewCredentials] = useState(null);
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const headers = { Authorization: `Bearer ${token}` };

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/customer/admin/all`, { headers });
      setCustomers(res.data);
    } catch { /* silent */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await axios.post(`${API}/customer/admin/create`, createForm, { headers });
      setNewCredentials(res.data);
      setShowCreate(false);
      setCreateForm({ first_name: '', last_name: '', email: '' });
      toast.success('Customer created');
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create customer');
    } finally {
      setCreating(false);
    }
  };

  const handleResetCredentials = async (customerId) => {
    try {
      const res = await axios.post(`${API}/customer/admin/${customerId}/reset-credentials`, null, { headers });
      setNewCredentials(res.data);
      toast.success('Credentials reset');
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset');
    }
  };

  const handleSuspend = async (customerId, currentStatus) => {
    const newStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    try {
      await axios.put(`${API}/customer/admin/${customerId}/status?status=${newStatus}`, null, { headers });
      toast.success(`Customer ${newStatus}`);
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (customerId) => {
    if (!window.confirm('Delete this customer? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/customer/admin/${customerId}`, { headers });
      toast.success('Customer deleted');
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleViewLocation = async (customer) => {
    setShowLocation(customer);
    setLocationData(null);
    setLocationLoading(true);
    try {
      const res = await axios.get(`${API}/customer/admin/${customer.id}/location`, { headers });
      setLocationData(res.data);
    } catch {
      setLocationData({ error: 'Failed to fetch location' });
    } finally {
      setLocationLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copied'));
  };

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-[#0056A8]" />
          <h2 className="text-xl font-bold text-white">Customer Accounts</h2>
          <span className="text-gray-500 text-sm">({customers.length})</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchCustomers} variant="outline" size="sm" className="border-gray-600 text-gray-300 hover:bg-gray-700">
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button onClick={() => setShowCreate(true)} size="sm" className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="create-customer-btn">
            <Plus className="w-4 h-4 mr-1" /> Create Customer
          </Button>
        </div>
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-500 mx-auto" /></div>
      ) : customers.length === 0 ? (
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardContent className="py-10 text-center">
            <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No customer accounts yet</p>
            <p className="text-gray-600 text-sm mt-1">Create one to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {customers.map((c) => (
            <Card key={c.id} className="bg-[#2a2a2a] border-gray-700">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Status indicator */}
                    <div className={`w-2.5 h-2.5 rounded-full ${c.status === 'active' ? 'bg-green-500' : c.status === 'suspended' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    
                    {/* Name + Email */}
                    <div>
                      <p className="text-white font-medium">{c.first_name} {c.last_name}</p>
                      <p className="text-gray-500 text-xs">{c.email}</p>
                    </div>

                    {/* Credentials */}
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-2">
                        <code className="bg-[#1a1a1a] text-green-400 px-2 py-0.5 rounded text-xs font-mono">{c.app_username}</code>
                        <span className="text-gray-600">:</span>
                        <code className="bg-[#1a1a1a] text-amber-400 px-2 py-0.5 rounded text-xs font-mono">
                          {visiblePasswords[c.id] ? c.app_password : '••••••'}
                        </code>
                        <button onClick={() => togglePasswordVisibility(c.id)} className="text-gray-500 hover:text-gray-300">
                          {visiblePasswords[c.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => copyToClipboard(`${c.app_username} / ${c.app_password}`)} className="text-gray-500 hover:text-gray-300">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${c.is_activated ? 'bg-green-900/30 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                      {c.is_activated ? 'Activated' : 'Pending'}
                    </span>
                    <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300" onClick={() => handleViewLocation(c)} title="View location">
                      <MapPin className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-amber-400 hover:text-amber-300" onClick={() => handleResetCredentials(c.id)} title="Reset credentials">
                      <KeyRound className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className={c.status === 'suspended' ? "text-green-400 hover:text-green-300" : "text-orange-400 hover:text-orange-300"} onClick={() => handleSuspend(c.id, c.status)} title={c.status === 'suspended' ? 'Reactivate' : 'Suspend'}>
                      {c.status === 'suspended' ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => handleDelete(c.id)} title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Customer Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-md" data-testid="create-customer-dialog">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#0056A8]" />
              Create Customer Account
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-2">
            <p className="text-gray-400 text-sm">Username and password will be auto-generated.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-white text-xs">First Name *</Label>
                <Input
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm(f => ({ ...f, first_name: e.target.value }))}
                  required
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                  data-testid="customer-first-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-white text-xs">Last Name *</Label>
                <Input
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm(f => ({ ...f, last_name: e.target.value }))}
                  required
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                  data-testid="customer-last-name"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-white text-xs">Email *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                required
                className="bg-[#2a2a2a] border-gray-600 text-white"
                data-testid="customer-email"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="border-gray-600 text-gray-300">Cancel</Button>
              <Button type="submit" disabled={creating} className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="submit-create-customer">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Credentials Dialog */}
      <Dialog open={!!newCredentials} onOpenChange={() => setNewCredentials(null)}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-md" data-testid="credentials-dialog">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-green-400" />
              {newCredentials?.message?.includes('reset') ? 'Credentials Reset' : 'Account Created'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-gray-400 text-sm">Save these credentials — the password cannot be retrieved later.</p>
            {newCredentials?.first_name && (
              <div className="bg-[#2a2a2a] rounded-lg p-3">
                <p className="text-gray-500 text-xs mb-1">Customer</p>
                <p className="text-white">{newCredentials.first_name} {newCredentials.last_name}</p>
              </div>
            )}
            <div className="bg-[#2a2a2a] rounded-lg p-3 space-y-3">
              <div>
                <p className="text-gray-500 text-xs mb-1">Username</p>
                <div className="flex items-center gap-2">
                  <code className="text-green-400 font-mono text-lg">{newCredentials?.app_username}</code>
                  <button onClick={() => copyToClipboard(newCredentials?.app_username)} className="text-gray-500 hover:text-white">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Password</p>
                <div className="flex items-center gap-2">
                  <code className="text-amber-400 font-mono text-lg">{newCredentials?.app_password}</code>
                  <button onClick={() => copyToClipboard(newCredentials?.app_password)} className="text-gray-500 hover:text-white">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setNewCredentials(null)} className="bg-[#0056A8] hover:bg-[#0066c8] w-full">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Location Dialog */}
      <Dialog open={!!showLocation} onOpenChange={() => setShowLocation(null)}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-sm" data-testid="location-dialog">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#0056A8]" />
              {showLocation?.first_name}'s Location
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {locationLoading ? (
              <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin text-gray-500 mx-auto" /></div>
            ) : locationData?.error ? (
              <p className="text-red-400 text-sm">{locationData.error}</p>
            ) : !locationData?.ip ? (
              <p className="text-gray-500 text-sm text-center py-4">No connection data recorded yet. This customer hasn't signed in.</p>
            ) : (
              <div className="space-y-3">
                <div className="bg-[#2a2a2a] rounded-lg p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500 text-xs">Public IP</span>
                    <code className="text-white text-sm font-mono">{locationData.ip}</code>
                  </div>
                  {locationData.location && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">City</span>
                        <span className="text-white text-sm">{locationData.location.city}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Region</span>
                        <span className="text-white text-sm">{locationData.location.region}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Country</span>
                        <span className="text-white text-sm">{locationData.location.country}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">ISP</span>
                        <span className="text-white text-sm">{locationData.location.isp}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 text-xs">Timezone</span>
                        <span className="text-white text-sm">{locationData.location.timezone}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setShowLocation(null)} variant="outline" className="border-gray-600 text-gray-300 w-full">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerManagementTab;
