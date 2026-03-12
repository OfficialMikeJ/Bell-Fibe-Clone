import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Trash2, Video, Circle, CheckCircle, XCircle, Clock } from 'lucide-react';
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
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = async () => {
    try {
      const params = filterStatus !== 'all' ? { status: filterStatus } : {};
      const [recRes, statRes] = await Promise.all([
        axios.get(`${API}/recordings`, { headers, params }),
        axios.get(`${API}/recordings/stats/summary`, { headers })
      ]);
      setRecordings(recRes.data);
      setStats(statRes.data);
    } catch (e) {
      toast.error('Failed to load recordings');
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

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    return `${(bytes / 1e6).toFixed(0)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">CVR — Cloud Video Recording</h2>
          <p className="text-gray-400 text-sm mt-1">Manage user recordings — view, update status, and delete</p>
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2 text-sm">
          <option value="all">All Statuses</option>
          {Object.keys(statusConfig).map(s => <option key={s} value={s}>{statusConfig[s].label}</option>)}
        </select>
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

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : recordings.length === 0 ? (
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardContent className="py-16 text-center">
            <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No recordings found</p>
            <p className="text-gray-500 text-sm mt-2">Recordings appear here when users schedule them via the Android app</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recordings.map((rec) => {
            const sc = statusConfig[rec.status] || statusConfig.scheduled;
            const Icon = sc.icon;
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
                      {rec.start_time && <span>Time: <span className="text-gray-300">{rec.start_time}</span></span>}
                      {rec.duration_minutes && <span>Duration: <span className="text-gray-300">{rec.duration_minutes}m</span></span>}
                      {rec.user_id && <span>User: <span className="text-gray-300">{rec.user_id}</span></span>}
                      {rec.file_size && <span>Size: <span className="text-gray-300">{formatFileSize(rec.file_size)}</span></span>}
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
  );
};

export default CVRTab;
