import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Pencil, Trash2, HelpCircle, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FAQ_CATEGORIES = ['General', 'Streaming/VOD', 'Android App', 'Recordings', 'Account', 'Network & Connectivity'];

const FAQTab = ({ token }) => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ question: '', answer: '', category: 'General', order: 0, is_active: true });

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { fetchFAQs(); }, []);

  const fetchFAQs = async () => {
    try {
      const res = await axios.get(`${API}/faq?all=true`, { headers });
      setFaqs(res.data);
    } catch { toast.error('Failed to load FAQ items'); }
    finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditingId(null);
    setForm({ question: '', answer: '', category: 'General', order: faqs.length, is_active: true });
    setIsDialogOpen(true);
  };

  const openEdit = (faq) => {
    setEditingId(faq.id);
    setForm({ question: faq.question, answer: faq.answer, category: faq.category, order: faq.order, is_active: faq.is_active });
    setIsDialogOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`${API}/faq/${editingId}`, form, { headers });
        toast.success('FAQ updated');
      } else {
        await axios.post(`${API}/faq`, form, { headers });
        toast.success('FAQ created');
      }
      setIsDialogOpen(false);
      fetchFAQs();
    } catch { toast.error('Failed to save FAQ item'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this FAQ item?')) return;
    try {
      await axios.delete(`${API}/faq/${id}`, { headers });
      setFaqs(prev => prev.filter(f => f.id !== id));
      toast.success('FAQ deleted');
    } catch { toast.error('Failed to delete FAQ item'); }
  };

  const toggleActive = async (faq) => {
    try {
      await axios.put(`${API}/faq/${faq.id}`, { is_active: !faq.is_active }, { headers });
      setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, is_active: !f.is_active } : f));
    } catch { toast.error('Failed to update FAQ status'); }
  };

  const byCategory = faqs.reduce((acc, f) => {
    (acc[f.category] = acc[f.category] || []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-white" />
          <h2 className="text-2xl font-semibold text-white">FAQ Management</h2>
          <span className="bg-[#0056A8] text-white text-xs px-2 py-0.5 rounded-full">{faqs.length}</span>
        </div>
        <Button onClick={openAdd} className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="add-faq-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add FAQ
        </Button>
      </div>

      {loading && <p className="text-gray-400">Loading FAQ items...</p>}

      {!loading && faqs.length === 0 && (
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardContent className="py-12 text-center">
            <HelpCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No FAQ items yet. Add your first one!</p>
          </CardContent>
        </Card>
      )}

      {Object.entries(byCategory).map(([category, items]) => (
        <Card key={category} className="bg-[#2a2a2a] border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.sort((a, b) => a.order - b.order).map(faq => (
              <div
                key={faq.id}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  faq.is_active ? 'bg-[#1a1a1a] border-gray-700' : 'bg-gray-900/50 border-gray-800 opacity-60'
                }`}
                data-testid={`faq-admin-item-${faq.id}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{faq.question}</p>
                  <p className="text-gray-400 text-xs mt-1 line-clamp-2">{faq.answer}</p>
                  <p className="text-gray-600 text-xs mt-1">Order: {faq.order}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleActive(faq)}
                    className={faq.is_active ? 'text-green-400 hover:text-green-300' : 'text-gray-500 hover:text-gray-400'}
                    title={faq.is_active ? 'Hide' : 'Show'}
                  >
                    {faq.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(faq)} className="text-blue-400 hover:text-blue-300">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(faq.id)} className="text-red-400 hover:text-red-300">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* FAQ Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">{editingId ? 'Edit FAQ' : 'Add FAQ Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-white">Question *</Label>
              <Input
                value={form.question}
                onChange={e => setForm({ ...form, question: e.target.value })}
                placeholder="What is the most common question?"
                required
                className="bg-[#2a2a2a] border-gray-600 text-white"
                data-testid="faq-question-input"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white">Answer *</Label>
              <Textarea
                value={form.answer}
                onChange={e => setForm({ ...form, answer: e.target.value })}
                placeholder="Provide a clear, helpful answer..."
                required
                rows={4}
                className="bg-[#2a2a2a] border-gray-600 text-white"
                data-testid="faq-answer-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Category</Label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-gray-600 rounded-md text-white text-sm"
                >
                  {FAQ_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Display Order</Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={e => setForm({ ...form, order: parseInt(e.target.value) || 0 })}
                  className="bg-[#2a2a2a] border-gray-600 text-white"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={form.is_active}
                onChange={e => setForm({ ...form, is_active: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="is_active" className="text-white text-sm cursor-pointer">Visible to customers</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" className="text-gray-400" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#0056A8] hover:bg-[#0066c8]" data-testid="save-faq-btn">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FAQTab;
