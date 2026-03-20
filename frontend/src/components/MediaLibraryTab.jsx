import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, Edit, Upload, Film, Image, RefreshCw, Plus, FileVideo } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const QUALITY_OPTIONS = ['720p', '720p60', '1080p', '1080p60', '1440p', '1440p60', '4K', '4K60'];
const MEDIA_TYPES = ['movie', 'tv_show', 'episode', 'mini_series', 'limited_series'];

const MediaLibraryTab = ({ token }) => {
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filterType, setFilterType] = useState('all');
  const fileInputRef = useRef(null);
  const posterInputRef = useRef(null);
  const [pendingPosterId, setPendingPosterId] = useState(null);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchMedia = async () => {
    try {
      const params = filterType !== 'all' ? { media_type: filterType } : {};
      const res = await axios.get(`${API}/media`, { headers, params });
      setMediaItems(res.data);
    } catch (e) {
      toast.error('Failed to load media library');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMedia(); }, [filterType]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`${API}/media/upload-file`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (p) => setUploadProgress(Math.round((p.loaded * 100) / p.total))
      });
      toast.success(`"${res.data.title}" uploaded — Duration: ${res.data.duration_formatted || 'analyzing'}, Quality: ${res.data.quality_label || 'unknown'}`);
      fetchMedia();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePosterUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !pendingPosterId) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`${API}/media/upload-poster/${pendingPosterId}`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Poster updated');
      fetchMedia();
    } catch (e) {
      toast.error('Poster upload failed');
    } finally {
      setPendingPosterId(null);
      if (posterInputRef.current) posterInputRef.current.value = '';
    }
  };

  const openPosterUpload = (mediaId) => {
    setPendingPosterId(mediaId);
    posterInputRef.current?.click();
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setEditForm({ title: item.title, description: item.description, media_type: item.media_type, genre: item.genre || '', year: item.year || '', rating: item.rating || '', quality_label: item.quality_label || '1080p' });
  };

  const handleSaveEdit = async () => {
    try {
      const updateData = { ...editForm };
      if (updateData.year) updateData.year = parseInt(updateData.year);
      await axios.put(`${API}/media/${editItem.id}`, updateData, { headers });
      toast.success('Media updated');
      setEditItem(null);
      fetchMedia();
    } catch (e) {
      toast.error('Update failed');
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try {
      await axios.delete(`${API}/media/${id}`, { headers });
      toast.success('Media deleted');
      fetchMedia();
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const handleReanalyze = async (id) => {
    try {
      const res = await axios.post(`${API}/media/${id}/reanalyze`, {}, { headers });
      toast.success(`Reanalyzed: ${res.data.duration_formatted}, ${res.data.quality_label}`);
      fetchMedia();
    } catch (e) {
      toast.error('Reanalysis failed — file may not exist on server');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes > 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes > 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
  };

  const typeColors = { movie: 'bg-blue-600', tv_show: 'bg-green-600', episode: 'bg-yellow-600', mini_series: 'bg-indigo-500', limited_series: 'bg-red-600' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Media Library</h2>
          <p className="text-gray-400 text-sm mt-1">Upload media files — FFmpeg auto-detects duration, resolution & quality</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2 text-sm">
            <option value="all">All Types</option>
            {MEDIA_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="upload-media-btn">
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? `Uploading ${uploadProgress}%` : 'Upload Media'}
          </Button>
        </div>
      </div>

      {uploading && (
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div className="bg-[#0056A8] h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="video/*,.mkv,.ts" className="hidden" onChange={handleFileUpload} />
      <input ref={posterInputRef} type="file" accept="image/*" className="hidden" onChange={handlePosterUpload} />

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading media library...</div>
      ) : mediaItems.length === 0 ? (
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardContent className="py-16 text-center">
            <FileVideo className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No media files yet</p>
            <p className="text-gray-500 text-sm mt-2">Upload your first media file to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {mediaItems.map((item) => (
            <Card key={item.id} className="bg-[#2a2a2a] border-gray-700 hover:border-gray-500 transition-colors" data-testid={`media-item-${item.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Poster */}
                  <div className="w-20 h-28 bg-[#3a3a3a] rounded-md overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.poster_path ? (
                      <img src={`${BACKEND_URL}/api${item.poster_path}`} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <Film className="w-8 h-8 text-gray-600" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-white font-semibold text-lg truncate">{item.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs text-white ${typeColors[item.media_type] || 'bg-gray-600'}`}>
                        {item.media_type?.replace('_', ' ')}
                      </span>
                      {item.quality_label && (
                        <span className="px-2 py-0.5 rounded text-xs text-white bg-[#0056A8]">{item.quality_label}</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm truncate mb-2">{item.description || 'No description'}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                      {item.duration_formatted && <span>Duration: <span className="text-gray-300">{item.duration_formatted}</span></span>}
                      {item.resolution && <span>Resolution: <span className="text-gray-300">{item.resolution}</span></span>}
                      {item.fps && <span>FPS: <span className="text-gray-300">{item.fps}</span></span>}
                      {item.file_size && <span>Size: <span className="text-gray-300">{formatFileSize(item.file_size)}</span></span>}
                      {item.year && <span>Year: <span className="text-gray-300">{item.year}</span></span>}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      onClick={() => handleEdit(item)} data-testid={`edit-media-${item.id}`}>
                      <Edit className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      onClick={() => openPosterUpload(item.id)}>
                      <Image className="w-3 h-3 mr-1" /> Poster
                    </Button>
                    <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      onClick={() => handleReanalyze(item.id)}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Analyze
                    </Button>
                    <Button size="sm" variant="destructive"
                      onClick={() => handleDelete(item.id, item.title)} data-testid={`delete-media-${item.id}`}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Media Metadata</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-white">Title</Label>
              <Input value={editForm.title || ''} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="bg-[#2a2a2a] border-gray-600 text-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-white">Description</Label>
              <Textarea value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="bg-[#2a2a2a] border-gray-600 text-white min-h-20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-white">Type</Label>
                <select value={editForm.media_type || 'movie'} onChange={(e) => setEditForm({ ...editForm, media_type: e.target.value })}
                  className="w-full bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2">
                  {MEDIA_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-white">Quality</Label>
                <select value={editForm.quality_label || '1080p'} onChange={(e) => setEditForm({ ...editForm, quality_label: e.target.value })}
                  className="w-full bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2">
                  {QUALITY_OPTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-white">Genre</Label>
                <Input value={editForm.genre || ''} onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                  placeholder="Action, Drama..." className="bg-[#2a2a2a] border-gray-600 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-white">Year</Label>
                <Input type="number" value={editForm.year || ''} onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                  placeholder="2024" className="bg-[#2a2a2a] border-gray-600 text-white" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-white">Rating</Label>
              <Input value={editForm.rating || ''} onChange={(e) => setEditForm({ ...editForm, rating: e.target.value })}
                placeholder="PG-13, TV-14, R..." className="bg-[#2a2a2a] border-gray-600 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setEditItem(null)} className="bg-gray-600 hover:bg-gray-700">Cancel</Button>
            <Button onClick={handleSaveEdit} className="bg-[#0056A8] hover:bg-[#0066c8]">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaLibraryTab;
