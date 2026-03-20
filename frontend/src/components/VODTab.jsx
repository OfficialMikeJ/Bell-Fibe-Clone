import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Trash2, Edit, Star, Plus, Tv, Film, Image } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CATEGORIES = ['movie', 'tv_show', 'mini_series', 'limited_series'];

const VODTab = ({ token }) => {
  const [items, setItems] = useState([]);
  const [mediaList, setMediaList] = useState([]);
  const [catalogList, setCatalogList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', media_id: '', catalog_id: '', category: 'movie', genre: '', year: '', rating: '', is_featured: false });
  const posterInputRef = useRef(null);
  const [posterVodId, setPosterVodId] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = async () => {
    try {
      const [vodRes, mediaRes, catalogRes] = await Promise.all([
        axios.get(`${API}/vod`, { params: filterCat !== 'all' ? { category: filterCat } : {} }),
        axios.get(`${API}/media`, { headers }),
        axios.get(`${API}/catalog`, { headers }),
      ]);
      setItems(vodRes.data);
      setMediaList(mediaRes.data);
      setCatalogList(catalogRes.data);
    } catch (e) {
      toast.error('Failed to load VOD catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [filterCat]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ title: '', description: '', media_id: '', catalog_id: '', category: 'movie', genre: '', year: '', rating: '', is_featured: false });
    setIsDialogOpen(true);
  };

  const openEdit = (item) => {
    setEditingId(item.id);
    setForm({ title: item.title, description: item.description || '', media_id: item.media_id || '', catalog_id: item.catalog_id || '', category: item.category, genre: item.genre || '', year: item.year || '', rating: item.rating || '', is_featured: item.is_featured });
    setIsDialogOpen(true);
  };

  const handleCatalogSelect = (catalogId) => {
    const entry = catalogList.find(c => c.id === catalogId);
    if (entry) {
      setForm(f => ({
        ...f,
        catalog_id: catalogId,
        title: f.title || entry.title,
        description: f.description || entry.description || '',
        genre: f.genre || (entry.genres || []).join(', '),
        year: f.year || (entry.release_date ? entry.release_date.slice(0, 4) : ''),
        rating: f.rating || entry.rating || '',
        category: entry.content_type === 'tv_series' ? 'tv_show' : f.category,
      }));
    } else {
      setForm(f => ({ ...f, catalog_id: catalogId }));
    }
  };

  const handleMediaSelect = (mediaId) => {
    const media = mediaList.find(m => m.id === mediaId);
    if (media) {
      setForm(f => ({ ...f, media_id: mediaId, title: f.title || media.title, description: f.description || media.description || '' }));
    } else {
      setForm(f => ({ ...f, media_id: mediaId }));
    }
  };

  const handleSave = async () => {
    if (!form.title) return toast.error('Title is required');
    const payload = { ...form, year: form.year ? parseInt(form.year) : null };
    try {
      if (editingId) {
        await axios.put(`${API}/vod/${editingId}`, payload, { headers });
        toast.success('VOD item updated');
      } else {
        await axios.post(`${API}/vod`, payload, { headers });
        toast.success('VOD item created');
      }
      setIsDialogOpen(false);
      fetchAll();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}" from VOD?`)) return;
    try {
      await axios.delete(`${API}/vod/${id}`, { headers });
      toast.success('VOD item deleted');
      fetchAll();
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const handlePosterUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !posterVodId) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      await axios.post(`${API}/vod/upload-poster/${posterVodId}`, formData, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
      toast.success('Poster updated');
      fetchAll();
    } catch (e) { toast.error('Poster upload failed'); }
    finally { setPosterVodId(null); if (posterInputRef.current) posterInputRef.current.value = ''; }
  };

  const catColors = { movie: 'bg-blue-600', tv_show: 'bg-green-600', mini_series: 'bg-indigo-500', limited_series: 'bg-red-600' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Video on Demand</h2>
          <p className="text-gray-400 text-sm mt-1">Manage VOD catalog — separate from time-slotted live channels</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}
            className="bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2 text-sm">
            <option value="all">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, x => x.toUpperCase())}</option>)}
          </select>
          <Button onClick={openAdd} className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="add-vod-btn">
            <Plus className="w-4 h-4 mr-2" /> Add VOD
          </Button>
        </div>
      </div>

      <input ref={posterInputRef} type="file" accept="image/*" className="hidden" onChange={handlePosterUpload} />

      {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : items.length === 0 ? (
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardContent className="py-16 text-center">
            <Tv className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No VOD content yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="bg-[#2a2a2a] border-gray-700 overflow-hidden" data-testid={`vod-item-${item.id}`}>
              <div className="aspect-[2/3] bg-[#3a3a3a] relative">
                {item.poster_path ? (
                  <img src={`${BACKEND_URL}/api${item.poster_path}`} alt={item.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Film className="w-12 h-12 text-gray-600" /></div>
                )}
                {item.is_featured && (
                  <div className="absolute top-2 right-2 bg-yellow-500 rounded-full p-1"><Star className="w-3 h-3 text-black" /></div>
                )}
                <span className={`absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs text-white ${catColors[item.category] || 'bg-gray-600'}`}>
                  {item.category?.replace('_', ' ')}
                </span>
              </div>
              <CardContent className="p-3">
                <h3 className="text-white font-medium text-sm truncate mb-1">{item.title}</h3>
                <p className="text-gray-500 text-xs truncate mb-2">{item.duration_formatted || (item.year ? String(item.year) : 'N/A')}</p>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700 text-xs py-1"
                    onClick={() => openEdit(item)}><Edit className="w-3 h-3" /></Button>
                  <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700 text-xs py-1"
                    onClick={() => { setPosterVodId(item.id); posterInputRef.current?.click(); }}><Image className="w-3 h-3" /></Button>
                  <Button size="sm" variant="destructive" className="text-xs py-1"
                    onClick={() => handleDelete(item.id, item.title)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{editingId ? 'Edit VOD Item' : 'Add VOD Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-white text-sm">Link Media Catalog Entry (auto-fills metadata)</Label>
              <select value={form.catalog_id} onChange={(e) => handleCatalogSelect(e.target.value)}
                className="w-full mt-1 bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2 text-sm"
                data-testid="vod-catalog-select">
                <option value="">— No catalog entry linked —</option>
                {catalogList.map(c => <option key={c.id} value={c.id}>{c.title} ({c.content_type?.replace(/_/g, ' ')}) {c.release_date ? `[${c.release_date.slice(0,4)}]` : ''}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-white text-sm">Link Media File (auto-fills duration & poster)</Label>
              <select value={form.media_id} onChange={(e) => handleMediaSelect(e.target.value)}
                className="w-full mt-1 bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2 text-sm">
                <option value="">— No media file linked —</option>
                {mediaList.map(m => <option key={m.id} value={m.id}>{m.title} ({m.duration_formatted || 'no duration'}) [{m.quality_label}]</option>)}
              </select>
            </div>
            <div><Label className="text-white text-sm">Title *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-[#2a2a2a] border-gray-600 text-white mt-1" /></div>
            <div><Label className="text-white text-sm">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-[#2a2a2a] border-gray-600 text-white mt-1 min-h-16" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-white text-sm">Category</Label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full mt-1 bg-[#2a2a2a] border border-gray-600 text-white rounded px-3 py-2 text-sm">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ').replace(/\b\w/g, x => x.toUpperCase())}</option>)}
                </select>
              </div>
              <div><Label className="text-white text-sm">Year</Label>
                <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2024" className="bg-[#2a2a2a] border-gray-600 text-white mt-1" /></div>
              <div><Label className="text-white text-sm">Genre</Label>
                <Input value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Action, Drama..." className="bg-[#2a2a2a] border-gray-600 text-white mt-1" /></div>
              <div><Label className="text-white text-sm">Rating</Label>
                <Input value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} placeholder="PG-13, TV-14..." className="bg-[#2a2a2a] border-gray-600 text-white mt-1" /></div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="w-4 h-4" />
              <span className="text-white text-sm">Featured (shown prominently in VOD catalog)</span>
            </label>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsDialogOpen(false)} className="bg-gray-600 hover:bg-gray-700">Cancel</Button>
            <Button onClick={handleSave} className="bg-[#0056A8] hover:bg-[#0066c8]">{editingId ? 'Update' : 'Add'} VOD</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VODTab;
