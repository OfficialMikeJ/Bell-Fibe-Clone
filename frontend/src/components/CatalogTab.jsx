import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Film, Search, Upload, X, UserPlus, Image as ImageIcon, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const CONTENT_TYPES = [
  'movie', 'tv_series', 'documentary', 'mini_series', 'special', 'short_film', 'animation',
];
const RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'NR'];

const EMPTY_FORM = {
  title: '', tagline: '', content_type: 'movie', genres: '',
  release_date: '', runtime_minutes: '', description: '',
  director: '', producers: '', studio: '',
  rating: 'NR', language: 'English', country: '', tags: '',
};

const imgUrl = (path) => path ? `${API}/api${path}` : null;

// ── Cast Section ──────────────────────────────────────────────────────────────
const CastSection = ({ entryId, cast, token, onRefresh }) => {
  const [name, setName]  = useState('');
  const [char, setChar]  = useState('');
  const photoRefs = useRef({});
  const headers = { Authorization: `Bearer ${token}` };

  const addMember = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await axios.post(`${API}/api/catalog/${entryId}/cast`, null, {
        params: { name: name.trim(), character: char.trim() || undefined },
        headers,
      });
      setName(''); setChar('');
      toast.success('Cast member added');
      onRefresh();
    } catch { toast.error('Failed to add cast member'); }
  };

  const removeMember = async (castId) => {
    try {
      await axios.delete(`${API}/api/catalog/${entryId}/cast/${castId}`, { headers });
      toast.success('Removed');
      onRefresh();
    } catch { toast.error('Failed to remove'); }
  };

  const uploadPhoto = async (castId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      await axios.post(`${API}/api/catalog/${entryId}/cast/${castId}/photo`, fd, { headers });
      toast.success('Photo uploaded');
      onRefresh();
    } catch { toast.error('Photo upload failed'); }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={addMember} className="flex gap-2">
        <Input value={name} onChange={e => setName(e.target.value)}
          placeholder="Actor name" required
          className="bg-[#2a2a2a] border-gray-600 text-white text-sm flex-1" data-testid="cast-name-input" />
        <Input value={char} onChange={e => setChar(e.target.value)}
          placeholder="Character (optional)"
          className="bg-[#2a2a2a] border-gray-600 text-white text-sm flex-1" data-testid="cast-char-input" />
        <Button type="submit" size="sm" className="bg-[#0056A8] hover:bg-[#0066c8] shrink-0" data-testid="add-cast-btn">
          <UserPlus className="w-3.5 h-3.5" />
        </Button>
      </form>
      {cast && cast.length > 0 && (
        <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
          {cast.map(m => (
            <div key={m.id} className="flex items-center gap-2 bg-[#1a1a1a] rounded-lg p-2 border border-gray-800">
              {m.photo_path ? (
                <img src={imgUrl(m.photo_path)} alt={m.name}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-1 ring-[#0056A8]/40" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-[#0056A8]/15 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-300 text-xs font-bold">{m.name[0]}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{m.name}</p>
                {m.character && <p className="text-gray-500 text-xs truncate italic">{m.character}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  title="Upload photo"
                  onClick={() => photoRefs.current[m.id]?.click()}
                  className="w-6 h-6 rounded flex items-center justify-center text-[#0056A8] hover:text-blue-400"
                >
                  <Upload className="w-3 h-3" />
                </button>
                <input ref={el => photoRefs.current[m.id] = el} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files[0] && uploadPhoto(m.id, e.target.files[0])} />
                <button type="button" onClick={() => removeMember(m.id)}
                  className="w-6 h-6 rounded flex items-center justify-center text-red-400 hover:text-red-300">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Gallery Section ───────────────────────────────────────────────────────────
const GallerySection = ({ entryId, images, token, onRefresh }) => {
  const inputRef = useRef();
  const headers = { Authorization: `Bearer ${token}` };

  const upload = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      await axios.post(`${API}/api/catalog/${entryId}/gallery`, fd, { headers });
      toast.success('Image added to gallery');
      onRefresh();
    } catch { toast.error('Upload failed'); }
  };

  const remove = async (path) => {
    try {
      await axios.delete(`${API}/api/catalog/${entryId}/gallery`, { params: { image_path: path }, headers });
      toast.success('Image removed');
      onRefresh();
    } catch { toast.error('Remove failed'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-white text-xs font-semibold">Gallery Images</span>
        <button type="button" onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 text-xs text-[#0056A8] hover:text-blue-400 border border-gray-700 px-2 py-1 rounded-lg"
          data-testid="gallery-upload-btn">
          <Plus className="w-3 h-3" /> Add Image
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => e.target.files[0] && upload(e.target.files[0])} />
      </div>
      {images && images.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {images.map((p, i) => (
            <div key={i} className="relative group">
              <img src={imgUrl(p)} alt="" className="w-20 h-14 object-cover rounded-lg ring-1 ring-gray-700" />
              <button type="button" onClick={() => remove(p)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 text-xs italic">No gallery images yet</p>
      )}
    </div>
  );
};

// ── Main CatalogTab ───────────────────────────────────────────────────────────
const CatalogTab = ({ token }) => {
  const [entries,   setEntries]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [open,      setOpen]      = useState(false);
  const [editId,    setEditId]    = useState(null);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  const posterRef   = useRef();
  const backdropRef = useRef();
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    try {
      const res = await axios.get(`${API}/api/catalog`, { headers });
      setEntries(res.data);
    } catch { toast.error('Failed to load catalog'); }
    finally { setLoading(false); }
  };

  const refreshEntry = async (id) => {
    try {
      const res = await axios.get(`${API}/api/catalog/${id}`);
      setEditEntry(res.data);
      setEntries(prev => prev.map(e => e.id === id ? res.data : e));
    } catch { /* ignore */ }
  };

  const openCreate = () => {
    setEditId(null);
    setEditEntry(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = async (entry) => {
    setEditId(entry.id);
    setEditEntry(entry);
    setForm({
      title:           entry.title || '',
      tagline:         entry.tagline || '',
      content_type:    entry.content_type || 'movie',
      genres:          (entry.genres || []).join(', '),
      release_date:    entry.release_date || '',
      runtime_minutes: entry.runtime_minutes || '',
      description:     entry.description || '',
      director:        entry.director || '',
      producers:       (entry.producers || []).join(', '),
      studio:          entry.studio || '',
      rating:          entry.rating || 'NR',
      language:        entry.language || 'English',
      country:         entry.country || '',
      tags:            (entry.tags || []).join(', '),
    });
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title:           form.title.trim(),
      tagline:         form.tagline.trim() || null,
      content_type:    form.content_type,
      genres:          form.genres.split(',').map(s => s.trim()).filter(Boolean),
      release_date:    form.release_date || null,
      runtime_minutes: form.runtime_minutes ? parseInt(form.runtime_minutes) : null,
      description:     form.description.trim(),
      director:        form.director.trim() || null,
      producers:       form.producers.split(',').map(s => s.trim()).filter(Boolean),
      studio:          form.studio.trim() || null,
      rating:          form.rating || null,
      language:        form.language.trim() || 'English',
      country:         form.country.trim() || null,
      tags:            form.tags.split(',').map(s => s.trim()).filter(Boolean),
    };
    try {
      if (editId) {
        const res = await axios.put(`${API}/api/catalog/${editId}`, payload, { headers });
        setEntries(prev => prev.map(e => e.id === editId ? res.data : e));
        setEditEntry(res.data);
        toast.success('Entry updated');
      } else {
        const res = await axios.post(`${API}/api/catalog`, payload, { headers });
        setEntries(prev => [res.data, ...prev]);
        setEditId(res.data.id);
        setEditEntry(res.data);
        toast.success('Entry created — you can now upload images and add cast');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this catalog entry?')) return;
    try {
      await axios.delete(`${API}/api/catalog/${id}`, { headers });
      setEntries(prev => prev.filter(e => e.id !== id));
      if (editId === id) setOpen(false);
      toast.success('Entry deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const uploadPoster = async (file) => {
    if (!editId) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await axios.post(`${API}/api/catalog/${editId}/poster`, fd, { headers });
      toast.success('Poster uploaded');
      refreshEntry(editId);
    } catch { toast.error('Poster upload failed'); }
  };

  const uploadBackdrop = async (file) => {
    if (!editId) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await axios.post(`${API}/api/catalog/${editId}/backdrop`, fd, { headers });
      toast.success('Backdrop uploaded');
      refreshEntry(editId);
    } catch { toast.error('Backdrop upload failed'); }
  };

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter === 'all' || e.content_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Film className="w-6 h-6 text-white" />
          <h2 className="text-2xl font-semibold text-white">Media Catalog</h2>
          <span className="bg-[#0056A8] text-white text-xs px-2 py-0.5 rounded-full">{entries.length}</span>
        </div>
        <Button onClick={openCreate} className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="add-catalog-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Entry
        </Button>
      </div>
      <p className="text-gray-400 text-sm">Full IMDB-style catalog with cast, images, and metadata. Link entries to VOD items and EPG programs.</p>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search titles..."
            className="bg-[#2a2a2a] border-gray-600 text-white pl-9" data-testid="catalog-search" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white text-sm"
          data-testid="catalog-type-filter">
          <option value="all">All Types</option>
          {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {loading && <p className="text-gray-400 text-sm">Loading catalog...</p>}

      {!loading && filtered.length === 0 && (
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardContent className="py-12 text-center">
            <Film className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">{entries.length === 0 ? 'No entries yet. Create your first one!' : 'No results match your search.'}</p>
          </CardContent>
        </Card>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(entry => (
          <Card key={entry.id} className="bg-[#2a2a2a] border-gray-700 overflow-hidden group cursor-pointer hover:border-[#0056A8]/30 transition-colors"
            data-testid={`catalog-entry-${entry.id}`}>
            <div className="aspect-[2/3] bg-[#1a1a1a] relative overflow-hidden">
              {entry.poster_path ? (
                <img src={imgUrl(entry.poster_path)} alt={entry.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#0056A8]/10 to-transparent">
                  <Film className="w-10 h-10 text-gray-600" />
                  <span className="text-gray-600 text-xs text-center px-2">{entry.title}</span>
                </div>
              )}
              <div className="absolute top-2 left-2">
                <span className="bg-[#0056A8]/80 text-white text-xs px-2 py-0.5 rounded font-mono capitalize">
                  {entry.content_type?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <CardContent className="p-3">
              <p className="text-white text-sm font-semibold truncate">{entry.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">
                {entry.release_date?.slice(0, 4) || '—'} {entry.rating && `• ${entry.rating}`}
              </p>
              {entry.genres?.length > 0 && (
                <p className="text-[#0056A8]/70 text-xs mt-1 truncate">{entry.genres.slice(0, 3).join(', ')}</p>
              )}
              <div className="flex gap-1.5 mt-3">
                <Button size="sm" variant="ghost" onClick={() => openEdit(entry)}
                  className="flex-1 text-blue-400 hover:text-blue-300 text-xs h-7" data-testid={`edit-catalog-${entry.id}`}>
                  <Pencil className="w-3 h-3 mr-1" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(entry.id)}
                  className="text-red-400 hover:text-red-300 h-7 px-2" data-testid={`delete-catalog-${entry.id}`}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editId ? `Edit: ${editEntry?.title || ''}` : 'New Catalog Entry'}</DialogTitle>
          </DialogHeader>

          {/* Image uploads — only after entry is created */}
          {editId && editEntry && (
            <div className="grid grid-cols-2 gap-4 mb-4 p-4 rounded-xl" style={{ background: '#111' }}>
              {/* Poster */}
              <div>
                <p className="text-white text-xs font-semibold mb-2 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5 text-[#0056A8]" /> Poster</p>
                <div className="aspect-[2/3] bg-[#2a2a2a] rounded-xl overflow-hidden relative cursor-pointer hover:bg-[#3a3a3a] transition-colors border-2 border-dashed border-gray-700 hover:border-[#0056A8]"
                  onClick={() => posterRef.current?.click()} data-testid="poster-upload-area">
                  {editEntry.poster_path ? (
                    <img src={imgUrl(editEntry.poster_path)} alt="poster" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Upload className="w-8 h-8 text-gray-600" />
                      <p className="text-gray-600 text-xs text-center">Click to upload poster<br/>(High-res JPG/PNG)</p>
                    </div>
                  )}
                </div>
                <input ref={posterRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files[0] && uploadPoster(e.target.files[0])} />
              </div>
              {/* Backdrop */}
              <div>
                <p className="text-white text-xs font-semibold mb-2 flex items-center gap-1"><ImageIcon className="w-3.5 h-3.5 text-blue-400" /> Backdrop</p>
                <div className="aspect-video bg-[#2a2a2a] rounded-xl overflow-hidden cursor-pointer hover:bg-[#3a3a3a] transition-colors border-2 border-dashed border-gray-700 hover:border-blue-600 mb-3"
                  onClick={() => backdropRef.current?.click()} data-testid="backdrop-upload-area">
                  {editEntry.backdrop_path ? (
                    <img src={imgUrl(editEntry.backdrop_path)} alt="backdrop" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Upload className="w-6 h-6 text-gray-600" />
                      <p className="text-gray-600 text-xs text-center">Click to upload backdrop<br/>(Wide format, 16:9)</p>
                    </div>
                  )}
                </div>
                <input ref={backdropRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files[0] && uploadBackdrop(e.target.files[0])} />
                <GallerySection entryId={editId} images={editEntry.additional_images} token={token}
                  onRefresh={() => refreshEntry(editId)} />
              </div>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label className="text-white text-xs">Title *</Label>
                <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                  placeholder="e.g. The Dark Knight" required
                  className="bg-[#2a2a2a] border-gray-600 text-white" data-testid="catalog-title-input" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-white text-xs">Tagline</Label>
                <Input value={form.tagline} onChange={e => setForm({...form, tagline: e.target.value})}
                  placeholder="Short tagline"
                  className="bg-[#2a2a2a] border-gray-600 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-white text-xs">Content Type</Label>
                <select value={form.content_type} onChange={e => setForm({...form, content_type: e.target.value})}
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white text-sm"
                  data-testid="catalog-content-type">
                  {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-white text-xs">Rating</Label>
                <select value={form.rating} onChange={e => setForm({...form, rating: e.target.value})}
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white text-sm"
                  data-testid="catalog-rating">
                  {RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-white text-xs">Release Date</Label>
                <Input type="date" value={form.release_date} onChange={e => setForm({...form, release_date: e.target.value})}
                  className="bg-[#2a2a2a] border-gray-600 text-white" data-testid="catalog-release-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-white text-xs">Runtime (minutes)</Label>
                <Input type="number" value={form.runtime_minutes} onChange={e => setForm({...form, runtime_minutes: e.target.value})}
                  placeholder="e.g. 120" min="1"
                  className="bg-[#2a2a2a] border-gray-600 text-white" data-testid="catalog-runtime" />
              </div>
              <div className="space-y-1">
                <Label className="text-white text-xs">Director</Label>
                <Input value={form.director} onChange={e => setForm({...form, director: e.target.value})}
                  placeholder="e.g. Christopher Nolan"
                  className="bg-[#2a2a2a] border-gray-600 text-white" data-testid="catalog-director" />
              </div>
              <div className="space-y-1">
                <Label className="text-white text-xs">Studio</Label>
                <Input value={form.studio} onChange={e => setForm({...form, studio: e.target.value})}
                  placeholder="e.g. Warner Bros."
                  className="bg-[#2a2a2a] border-gray-600 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-white text-xs">Language</Label>
                <Input value={form.language} onChange={e => setForm({...form, language: e.target.value})}
                  className="bg-[#2a2a2a] border-gray-600 text-white" />
              </div>
              <div className="space-y-1">
                <Label className="text-white text-xs">Country</Label>
                <Input value={form.country} onChange={e => setForm({...form, country: e.target.value})}
                  placeholder="e.g. USA"
                  className="bg-[#2a2a2a] border-gray-600 text-white" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-white text-xs">Genres <span className="text-gray-500">(comma-separated)</span></Label>
                <Input value={form.genres} onChange={e => setForm({...form, genres: e.target.value})}
                  placeholder="e.g. Action, Crime, Drama"
                  className="bg-[#2a2a2a] border-gray-600 text-white" data-testid="catalog-genres" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-white text-xs">Producers <span className="text-gray-500">(comma-separated)</span></Label>
                <Input value={form.producers} onChange={e => setForm({...form, producers: e.target.value})}
                  placeholder="e.g. Emma Thomas, Charles Roven"
                  className="bg-[#2a2a2a] border-gray-600 text-white" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-white text-xs">Tags <span className="text-gray-500">(comma-separated)</span></Label>
                <Input value={form.tags} onChange={e => setForm({...form, tags: e.target.value})}
                  placeholder="e.g. superhero, dark, award-winning"
                  className="bg-[#2a2a2a] border-gray-600 text-white" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-white text-xs">Description / Bio</Label>
                <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Full description of the title..."
                  rows={4}
                  className="bg-[#2a2a2a] border-gray-600 text-white" data-testid="catalog-description" />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" className="text-gray-400" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#0056A8] hover:bg-[#0066c8]" disabled={saving} data-testid="save-catalog-btn">
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Entry'}
              </Button>
            </DialogFooter>
          </form>

          {/* Cast Section — only in edit mode after creation */}
          {editId && editEntry && (
            <div className="mt-2 pt-4 border-t border-gray-800">
              <p className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-[#0056A8]" />
                Cast ({(editEntry.cast || []).length} members)
              </p>
              <CastSection
                entryId={editId}
                cast={editEntry.cast}
                token={token}
                onRefresh={() => refreshEntry(editId)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CatalogTab;
