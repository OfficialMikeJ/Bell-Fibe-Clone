import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Trash2, Video, Circle, CheckCircle, XCircle, Clock, HardDrive, UserCheck, UserX, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statusConfig = {
  scheduled: { label: 'Scheduled', color: 'bg-yellow-600', icon: Clock },
  recording: { label: 'Recording', color: 'bg-red-600', icon: Circle },
  completed: { label: 'Completed', color: 'bg-green-600', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-gray-600', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-700', icon: XCircle },
};

const CVRTab = ({ token }) => {
  const [recordings, setRecordings] = useState([]);
  const [hoursRequests, setHoursRequests] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeSection, setActiveSection] = useState('recordings'); // 'recordings' | 'hours' | 'storage'
  const [storageConfig, setStorageConfig] = useState({ cvr_total_storage_gb: 500, cvr_storage_path: '/app/backend/uploads/cvr', hours_request_min: 96, hours_request_max: 105 });
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = async () => {
    try {
      const params = filterStatus !== 'all' ? { status: filterStatus } : {};
      const [recRes, statRes, hrRes, configRes] = await Promise.all([
        axios.get(`${API}/recordings`, { headers, params }),
        axios.get(`${API}/recordings/stats/summary`, { headers }),
        axios.get(`${API}/security/hours-requests`, { headers }),
        axios.get(`${API}/setup/config`)
      ]);
      setRecordings(recRes.data);
      setStats(statRes.data);
      setHoursRequests(hrRes.data);
      if (configRes.data) {
        setStorageConfig(prev => ({
          ...prev,
          cvr_total_storage_gb: configRes.data.cvr_total_storage_gb || prev.cvr_total_storage_gb,
          hours_request_min: configRes.data.hours_request_min || prev.hours_request_min,
          hours_request_max: configRes.data.hours_request_max || prev.hours_request_max,
        }));
      }
    } catch (e) {
      toast.error('Failed to load CVR data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [filterStatus]);

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      await axios.put(`${API}/recordings/${id}`, { status: newStatus }, { headers });
      toast.success(`Recording marked as ${newStatus}`);
      fetchAll();
    } catch (e) { toast.error('Update failed'); }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete recording "${title}"?`)) return;
    try {
      await axios.delete(`${API}/recordings/${id}`, { headers });
      toast.success('Recording deleted');
      fetchAll();
    } catch (e) { toast.error('Delete failed'); }
  };

  const handleHoursRequestAction = async (reqId, status, adminNote = '') => {
    try {
      await axios.put(`${API}/security/hours-requests/${reqId}`, { status, admin_note: adminNote }, { headers });
      toast.success(`Request ${status}`);
      fetchAll();
    } catch (e) { toast.error('Failed to update request'); }
  };

  const handleSaveStorageConfig = async () => {
    try {
      await axios.post(`${API}/setup/service-config`, null, {
        headers,
        params: {
          service_name: undefined,
          cvr_total_storage_gb: storageConfig.cvr_total_storage_gb,
          hours_request_min: storageConfig.hours_request_min,
          hours_request_max: storageConfig.hours_request_max,
        }
      });
      toast.success('CVR storage configuration saved');
    } catch (e) { toast.error('Failed to save configuration'); }
  };

  const pendingRequests = hoursRequests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">CVR — Cloud Video Recording</h2>
          <p className="text-gray-400 text-sm mt-1">Manage user recordings, storage configuration, and hours requests</p>
        </div>
        {pendingRequests.length > 0 && (
          <div className="flex items-center gap-2 bg-yellow-900/30 border border-yellow-700 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-300 text-sm font-medium">{pendingRequests.length} pending hours request{pendingRequests.length > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-3">
        {[
          { id: 'recordings', label: 'Recordings', count: recordings.length },
          { id: 'hours', label: 'Hours Requests', count: pendingRequests.length },
          { id: 'storage', label: 'Storage Config' },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${activeSection === s.id ? 'bg-[#0056A8] text-white' : 'bg-[#2a2a2a] text-gray-400 hover:text-white'}`}>
            {s.label}
            {s.count > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${activeSection === s.id ? 'bg-white/20' : 'bg-yellow-600 text-white'}`}>{s.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[['Total', stats.total || 0, 'bg-gray-700'], ['Scheduled', stats.scheduled || 0, 'bg-yellow-700'], ['Completed', stats.completed || 0, 'bg-green-700'], ['Failed', stats.failed || 0, 'bg-red-700']].map(([label, count, bg]) => (
          <Card key={label} className={`${bg} border-0`}>
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-white">{count}</div>
              <div className="text-sm text-gray-200">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recordings Section */}
      {activeSection === 'recordings' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2 text-sm">
              <option value="all">All Statuses</option>
              {Object.keys(statusConfig).map(s => <option key={s} value={s}>{statusConfig[s].label}</option>)}
            </select>
            <span className="text-gray-400 text-sm">{recordings.length} recordings</span>
          </div>

          {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : recordings.length === 0 ? (
            <Card className="bg-[#2a2a2a] border-gray-700">
              <CardContent className="py-16 text-center">
                <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No recordings found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {recordings.map((rec) => {
                const sc = statusConfig[rec.status] || statusConfig.scheduled;
                const Icon = sc.icon;
                const recHours = rec.duration_minutes ? (rec.duration_minutes / 60).toFixed(2) : null;
                return (
                  <Card key={rec.id} className="bg-[#2a2a2a] border-gray-700" data-testid={`recording-${rec.id}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${sc.color}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-white font-semibold truncate">{rec.program_title}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs text-white ${sc.color}`}>{sc.label}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                          {rec.channel_name && <span>Channel: <span className="text-gray-300">{rec.channel_name}</span></span>}
                          {rec.date && <span>Date: <span className="text-gray-300">{rec.date}</span></span>}
                          {recHours && <span>Storage: <span className="text-gray-300">{recHours} hrs</span></span>}
                          {rec.user_id && <span>User: <span className="text-gray-300">{rec.user_id}</span></span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {rec.status === 'scheduled' && (
                          <>
                            <Button size="sm" className="bg-green-700 hover:bg-green-600 text-xs"
                              onClick={() => handleStatusUpdate(rec.id, 'completed')}>Complete</Button>
                            <Button size="sm" className="bg-red-700 hover:bg-red-600 text-xs"
                              onClick={() => handleStatusUpdate(rec.id, 'failed')}>Fail</Button>
                          </>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(rec.id, rec.program_title)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Hours Requests Section */}
      {activeSection === 'hours' && (
        <div className="space-y-3">
          {hoursRequests.length === 0 ? (
            <Card className="bg-[#2a2a2a] border-gray-700">
              <CardContent className="py-12 text-center">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No hours requests yet</p>
              </CardContent>
            </Card>
          ) : (
            hoursRequests.map((req) => (
              <Card key={req.id} className="bg-[#2a2a2a] border-gray-700" data-testid={`hours-request-${req.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-white font-semibold">{req.username || req.user_id}</h3>
                        <span className={`px-2 py-0.5 rounded text-xs text-white ${req.status === 'pending' ? 'bg-yellow-600' : req.status === 'approved' ? 'bg-green-600' : 'bg-gray-600'}`}>{req.status}</span>
                      </div>
                      <p className="text-gray-400 text-sm">Current: <span className="text-white">{req.current_hours} hrs</span> → Requested: <span className="text-blue-300 font-medium">{req.requested_hours} hrs</span></p>
                      {req.reason && <p className="text-gray-500 text-xs mt-1">Reason: {req.reason}</p>}
                      {req.admin_note && <p className="text-yellow-400 text-xs mt-1">Admin note: {req.admin_note}</p>}
                      <p className="text-gray-600 text-xs mt-1">{new Date(req.created_at).toLocaleString()}</p>
                    </div>
                    {req.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" className="bg-green-700 hover:bg-green-600" data-testid={`approve-hours-${req.id}`}
                          onClick={() => handleHoursRequestAction(req.id, 'approved')}>
                          <UserCheck className="w-3 h-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" className="bg-red-700 hover:bg-red-600"
                          onClick={() => handleHoursRequestAction(req.id, 'denied', 'Request denied by admin')}>
                          <UserX className="w-3 h-3 mr-1" /> Deny
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Storage Config Section */}
      {activeSection === 'storage' && (
        <Card className="bg-[#2a2a2a] border-gray-700 max-w-lg">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-[#0056A8]" /> CVR Storage Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="text-white">Total CVR Storage Allocated (GB)</Label>
              <Input type="number" value={storageConfig.cvr_total_storage_gb}
                onChange={(e) => setStorageConfig({ ...storageConfig, cvr_total_storage_gb: parseInt(e.target.value) })}
                className="bg-[#3a3a3a] border-gray-600 text-white" />
              <p className="text-xs text-gray-500">Total GB available for all user recordings</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Min Hours Request</Label>
                <Input type="number" value={storageConfig.hours_request_min}
                  onChange={(e) => setStorageConfig({ ...storageConfig, hours_request_min: parseInt(e.target.value) })}
                  className="bg-[#3a3a3a] border-gray-600 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Max Hours Request</Label>
                <Input type="number" value={storageConfig.hours_request_max}
                  onChange={(e) => setStorageConfig({ ...storageConfig, hours_request_max: parseInt(e.target.value) })}
                  className="bg-[#3a3a3a] border-gray-600 text-white" />
              </div>
            </div>
            <p className="text-xs text-gray-400 bg-gray-800 p-3 rounded-lg">
              Default per-user allocation: <span className="text-white">95 hours</span>.
              Users may request between <span className="text-white">{storageConfig.hours_request_min}–{storageConfig.hours_request_max}</span> hours.
              Approve requests from the "Hours Requests" tab.
            </p>
            <Button onClick={handleSaveStorageConfig} className="bg-[#0056A8] hover:bg-[#0066c8] w-full" data-testid="save-storage-config-btn">
              Save Storage Configuration
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CVRTab;
