import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { HardDrive, Clock, Film, Tv, Video, AlertCircle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const COLORS = ['#0056A8', '#00C49F', '#FFBB28', '#FF8042', '#a855f7', '#ef4444', '#22c55e', '#f97316', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];

const StorageBar = ({ label, used, total, unit = 'GB', color = '#0056A8' }) => {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const isHigh = pct > 80;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-300">{label}</span>
        <span className={isHigh ? 'text-red-400 font-semibold' : 'text-gray-300'}>{used.toFixed(1)} / {total} {unit}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-3">
        <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: isHigh ? '#ef4444' : color }} />
      </div>
      <div className="text-xs text-gray-500">{(100 - pct).toFixed(1)}% available</div>
    </div>
  );
};

const AnalyticsTab = ({ token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get(`${API}/stats/analytics`, { headers });
        setData(res.data);
      } catch (e) {
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="text-center py-20 text-gray-400">Loading analytics...</div>;
  if (error) return <div className="text-center py-20 text-red-400">{error}</div>;

  const contentTypeLabels = { movie: 'Movie', tv_show: 'TV Show', episode: 'Episode', mini_series: 'Mini Series', limited_series: 'Limited Series' };
  const contentTypesFormatted = (data.content_types || []).map(d => ({ ...d, type: contentTypeLabels[d.type] || d.type }));
  const storage = data.storage || {};
  const counts = data.counts || {};
  const recHours = data.recording_hours || {};

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
        <p className="text-gray-400 text-sm mt-1">Content statistics, storage usage, and system health</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Channels', value: counts.channels || 0, icon: Tv, color: 'text-blue-400' },
          { label: 'Media Files', value: counts.media_files || 0, icon: Film, color: 'text-green-400' },
          { label: 'VOD Titles', value: counts.vod_items || 0, icon: Video, color: 'text-[#0056A8]' },
          { label: 'Recordings', value: counts.total_recordings || 0, icon: Clock, color: 'text-yellow-400' },
          { label: 'Hour Requests', value: counts.pending_hours_requests || 0, icon: AlertCircle, color: counts.pending_hours_requests > 0 ? 'text-red-400' : 'text-gray-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-[#2a2a2a] border-gray-700">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`w-8 h-8 ${color} flex-shrink-0`} />
              <div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-xs text-gray-400">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Storage Usage */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[#0056A8]" /> Storage Overview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <StorageBar label="CVR Recording Storage" used={storage.cvr_used_gb || 0} total={storage.cvr_total_gb || 500} color="#0056A8" />
          <StorageBar label="Uploaded Media (Guide + VOD)" used={storage.media_uploaded_gb || 0} total={Math.max(storage.media_uploaded_gb || 0, 100)} color="#22c55e" />
          <StorageBar label="Total Uploads (All files)" used={storage.total_uploads_gb || 0} total={Math.max(storage.total_uploads_gb || 0, 100)} color="#f97316" />
          <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-700">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{storage.disk_free_gb?.toFixed(1) || '0'} GB</div>
              <div className="text-xs text-gray-400">Disk Free</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{recHours.total_allocated_hours || 0} hrs</div>
              <div className="text-xs text-gray-400">Total CVR Hours Allocated</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{recHours.total_used_hours || 0} hrs</div>
              <div className="text-xs text-gray-400">CVR Hours Used</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Type + Genre Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Media Content Types</CardTitle>
          </CardHeader>
          <CardContent>
            {contentTypesFormatted.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={contentTypesFormatted} cx="50%" cy="50%" outerRadius={80}
                    dataKey="count" nameKey="type" label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}>
                    {contentTypesFormatted.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Count']} contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #555', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#ccc' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-500 text-sm">No media files yet — upload content to see breakdown</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Genre Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.genres?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.genres} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis type="number" stroke="#888" tick={{ fill: '#aaa', fontSize: 11 }} />
                  <YAxis type="category" dataKey="genre" stroke="#888" tick={{ fill: '#aaa', fontSize: 10 }} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #555', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#ccc' }} />
                  <Bar dataKey="count" fill="#0056A8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-500 text-sm">No genre data — add genres when uploading media</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Channel Popularity + Popular VOD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Most Recorded Channels</CardTitle>
          </CardHeader>
          <CardContent>
            {data.channel_popularity?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.channel_popularity} margin={{ left: 0, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="channel" stroke="#888" tick={{ fill: '#aaa', fontSize: 10 }} angle={-15} textAnchor="end" height={40} />
                  <YAxis stroke="#888" tick={{ fill: '#aaa', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #555', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#ccc' }} />
                  <Bar dataKey="recordings" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-500 text-sm">No recordings yet — channel stats appear when users record</div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Most Watched VOD</CardTitle>
          </CardHeader>
          <CardContent>
            {data.popular_vod?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.popular_vod} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis type="number" stroke="#888" tick={{ fill: '#aaa', fontSize: 11 }} />
                  <YAxis type="category" dataKey="title" stroke="#888" tick={{ fill: '#aaa', fontSize: 10 }} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #555', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#ccc' }} />
                  <Bar dataKey="views" fill="#a855f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 flex items-center justify-center text-gray-500 text-sm">No VOD views yet — view_count increments as users watch content</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recording Status */}
      {data.recording_statuses?.length > 0 && (
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Recording Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.recording_statuses}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="status" stroke="#888" tick={{ fill: '#aaa', fontSize: 12 }} />
                <YAxis stroke="#888" tick={{ fill: '#aaa', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#2a2a2a', border: '1px solid #555', borderRadius: '8px' }} labelStyle={{ color: '#fff' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {data.recording_statuses.map((d, i) => (
                    <Cell key={i} fill={
                      d.status === 'completed' ? '#22c55e' :
                      d.status === 'scheduled' ? '#eab308' :
                      d.status === 'failed' ? '#ef4444' : '#6b7280'
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsTab;
