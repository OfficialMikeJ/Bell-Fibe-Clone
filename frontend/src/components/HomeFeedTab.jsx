import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, Zap, Star, Eye, EyeOff, Rss } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CATEGORIES = [
  { value: 'app_update',       label: 'App Update',       colorClass: 'bg-blue-700' },
  { value: 'upcoming_feature', label: 'Upcoming Feature', colorClass: 'bg-purple-700' },
];

const EMPTY_FORM = { title: '', body: '', category: 'app_update', is_published: true, version_tag: '' };

const HomeFeedTab = ({ token }) => {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);
  const [editId,  setEditId]  = useState(null);
  const [form,    setForm]    = useState(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchPosts(); }, []);

  const fetchPosts = async () => {
    try {
      const res = await axios.get(`${API}/home-posts/admin/all`, { headers });
      setPosts(res.data);
    } catch {
      toast.error('Failed to load home feed posts');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (post) => {
    setEditId(post.id);
    setForm({
      title:        post.title,
      body:         post.body,
      category:     post.category,
      is_published: post.is_published,
      version_tag:  post.version_tag || '',
    });
    setOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, version_tag: form.version_tag.trim() || null };
      if (editId) {
        const res = await axios.put(`${API}/home-posts/${editId}`, payload, { headers });
        setPosts(prev => prev.map(p => p.id === editId ? res.data : p));
        toast.success('Post updated');
      } else {
        const res = await axios.post(`${API}/home-posts`, payload, { headers });
        setPosts(prev => [res.data, ...prev]);
        toast.success('Post created');
      }
      setOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await axios.delete(`${API}/home-posts/${id}`, { headers });
      setPosts(prev => prev.filter(p => p.id !== id));
      toast.success('Post deleted');
    } catch {
      toast.error('Failed to delete post');
    }
  };

  const togglePublished = async (post) => {
    try {
      const res = await axios.put(`${API}/home-posts/${post.id}`, { is_published: !post.is_published }, { headers });
      setPosts(prev => prev.map(p => p.id === post.id ? res.data : p));
    } catch {
      toast.error('Failed to update post visibility');
    }
  };

  const byCategory = CATEGORIES.map(cat => ({
    ...cat,
    items: posts.filter(p => p.category === cat.value),
  }));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Rss className="w-6 h-6 text-white" />
          <h2 className="text-2xl font-semibold text-white">Home Feed</h2>
          <span className="bg-[#0056A8] text-white text-xs px-2 py-0.5 rounded-full">{posts.length}</span>
        </div>
        <Button onClick={openAdd} className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="add-home-post-btn">
          <Plus className="w-4 h-4 mr-2" />
          New Post
        </Button>
      </div>

      <p className="text-gray-400 text-sm">
        Posts published here appear on the customer-facing <strong className="text-gray-300">Home</strong> page.
        Use <em>App Update</em> for release notes and <em>Upcoming Feature</em> for roadmap items.
      </p>

      {loading && <p className="text-gray-400 text-sm">Loading posts...</p>}

      {!loading && posts.length === 0 && (
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardContent className="py-12 text-center">
            <Rss className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No posts yet. Create your first one!</p>
          </CardContent>
        </Card>
      )}

      {byCategory.map(cat => cat.items.length === 0 ? null : (
        <Card key={cat.value} className="bg-[#2a2a2a] border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 ${cat.colorClass} text-white text-xs font-semibold px-2.5 py-1 rounded-full`}>
                {cat.label}
              </span>
              <span className="text-gray-500 font-normal text-xs">
                {cat.items.length} post{cat.items.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cat.items.map(post => (
              <div
                key={post.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  post.is_published
                    ? 'bg-[#1a1a1a] border-gray-700'
                    : 'bg-gray-900/50 border-gray-800 opacity-60'
                }`}
                data-testid={`home-post-admin-${post.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <p className="text-white text-sm font-medium truncate">{post.title}</p>
                    {post.version_tag && (
                      <span className="text-gray-500 text-xs font-mono bg-gray-800 px-1.5 py-0.5 rounded shrink-0">
                        {post.version_tag}
                      </span>
                    )}
                    {!post.is_published && (
                      <span className="text-yellow-500 text-xs bg-yellow-900/30 px-1.5 py-0.5 rounded shrink-0">
                        Draft
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs line-clamp-2">{post.body}</p>
                  <p className="text-gray-600 text-xs mt-1">
                    {new Date(post.created_at).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => togglePublished(post)}
                    className={post.is_published ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-gray-400'}
                    title={post.is_published ? 'Unpublish' : 'Publish'}
                    data-testid={`toggle-post-${post.id}`}
                  >
                    {post.is_published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEdit(post)}
                    className="text-blue-400 hover:text-blue-300"
                    data-testid={`edit-post-${post.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(post.id)}
                    className="text-red-400 hover:text-red-300"
                    data-testid={`delete-post-${post.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editId ? 'Edit Post' : 'New Home Feed Post'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-white">Title *</Label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Version 1.2.0 released"
                required
                className="bg-[#2a2a2a] border-gray-600 text-white"
                data-testid="post-title-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Body *</Label>
              <Textarea
                value={form.body}
                onChange={e => setForm({ ...form, body: e.target.value })}
                placeholder="What's new or what's coming..."
                required
                rows={4}
                className="bg-[#2a2a2a] border-gray-600 text-white"
                data-testid="post-body-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Category</Label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white text-sm"
                  data-testid="post-category-select"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-white">
                  Version Tag <span className="text-gray-500 font-normal">(optional)</span>
                </Label>
                <Input
                  value={form.version_tag}
                  onChange={e => setForm({ ...form, version_tag: e.target.value })}
                  placeholder="e.g. v1.2.0"
                  className="bg-[#2a2a2a] border-gray-600 text-white font-mono"
                  data-testid="post-version-input"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_published"
                checked={form.is_published}
                onChange={e => setForm({ ...form, is_published: e.target.checked })}
                className="rounded"
                data-testid="post-published-checkbox"
              />
              <Label htmlFor="is_published" className="text-white text-sm cursor-pointer">
                Published (visible to customers)
              </Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" className="text-gray-400" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-[#0056A8] hover:bg-[#0066c8]"
                disabled={saving}
                data-testid="save-post-btn"
              >
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Create Post'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomeFeedTab;
