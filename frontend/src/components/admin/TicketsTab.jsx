import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Ticket, ChevronDown, ChevronRight, Send, Trash2, BadgeCheck, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50 border-red-200' },
  { value: 'high',     label: 'High',     color: 'bg-orange-500', text: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { value: 'medium',   label: 'Medium',   color: 'bg-yellow-500', text: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  { value: 'info',     label: 'Info',     color: 'bg-blue-500',   text: 'text-blue-600',  bg: 'bg-blue-50 border-blue-200' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500',  text: 'text-green-600', bg: 'bg-green-50 border-green-200' },
];

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
const STATUS_COLORS = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-500',
};

const getPriority = (val) => PRIORITIES.find(p => p.value === val) || PRIORITIES[2];

const TicketsTab = ({ token }) => {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchTickets = useCallback(async () => {
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      const res = await axios.get(`${API}/tickets`, { headers, params });
      setTickets(res.data);
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  }, [filterStatus, filterPriority, token]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const selected = tickets.find(t => t.id === selectedId);

  const updateTicket = async (id, fields) => {
    try {
      await axios.put(`${API}/tickets/${id}`, fields, { headers });
      setTickets(prev => prev.map(t => t.id === id ? { ...t, ...fields } : t));
      toast.success('Ticket updated');
    } catch { toast.error('Failed to update ticket'); }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      const res = await axios.post(
        `${API}/tickets/${selected.id}/reply`,
        { message: reply, sender_id: 'admin', is_admin: true },
        { headers }
      );
      setTickets(prev => prev.map(t => t.id === res.data.id ? res.data : t));
      setSelectedId(res.data.id);
      setReply('');
      toast.success('Reply sent');
    } catch { toast.error('Failed to send reply'); }
    finally { setSending(false); }
  };

  const deleteTicket = async (id) => {
    if (!window.confirm('Delete this ticket permanently?')) return;
    try {
      await axios.delete(`${API}/tickets/${id}`, { headers });
      setTickets(prev => prev.filter(t => t.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast.success('Ticket deleted');
    } catch { toast.error('Failed to delete ticket'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Ticket className="w-6 h-6 text-white" />
          <h2 className="text-2xl font-semibold text-white">Support Tickets</h2>
          <span className="bg-[#0056A8] text-white text-xs px-2 py-0.5 rounded-full">{tickets.length}</span>
        </div>
        {/* Filters */}
        <div className="flex gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-2 py-1.5"
            data-testid="filter-status-select"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="bg-[#2a2a2a] border border-gray-600 text-white text-sm rounded px-2 py-1.5"
            data-testid="filter-priority-select"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ticket List */}
        <div className="space-y-2">
          {loading && <p className="text-gray-400 text-sm p-4">Loading tickets...</p>}
          {!loading && tickets.length === 0 && (
            <Card className="bg-[#2a2a2a] border-gray-700">
              <CardContent className="py-10 text-center text-gray-400">
                <Ticket className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No tickets yet</p>
              </CardContent>
            </Card>
          )}
          {tickets.map(ticket => {
            const pri = getPriority(ticket.priority);
            return (
              <div
                key={ticket.id}
                onClick={() => setSelectedId(ticket.id === selectedId ? null : ticket.id)}
                className={`bg-[#2a2a2a] border rounded-xl p-4 cursor-pointer transition-all hover:border-[#0056A8] ${
                  selectedId === ticket.id ? 'border-[#0056A8] ring-1 ring-[#0056A8]' : 'border-gray-700'
                }`}
                data-testid={`ticket-item-${ticket.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1.5 ${pri.color}`} title={pri.label} />
                    <div className="min-w-0">
                      <p className="text-white font-medium text-sm truncate">{ticket.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{ticket.ticket_type}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[ticket.status] || 'bg-gray-700 text-gray-300'}`}>
                      #{ticket.status.replace('_', '-')}
                    </span>
                    {selectedId === ticket.id
                      ? <ChevronDown className="w-4 h-4 text-gray-400" />
                      : <ChevronRight className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span>{ticket.device_name || ticket.user_id}</span>
                  {ticket.public_ip && <span className="font-mono">{ticket.public_ip}</span>}
                  <span>{new Date(ticket.created_at).toLocaleDateString('en-CA')}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Ticket Detail Panel */}
        {selected && (
          <Card className="bg-[#2a2a2a] border-gray-700 h-fit sticky top-4">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-white text-lg leading-tight">{selected.title}</CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteTicket(selected.id)}
                  className="text-red-400 hover:text-red-300 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs text-gray-400 bg-[#1a1a1a] px-2 py-1 rounded">{selected.ticket_type}</span>
                {selected.public_ip && (
                  <span className="text-xs text-gray-400 bg-[#1a1a1a] px-2 py-1 rounded font-mono">
                    IP: {selected.public_ip}
                  </span>
                )}
                {selected.device_name && (
                  <span className="text-xs text-gray-400 bg-[#1a1a1a] px-2 py-1 rounded">
                    {selected.device_name}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Controls */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Priority</p>
                  <select
                    value={selected.priority}
                    onChange={e => updateTicket(selected.id, { priority: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-gray-600 text-white text-sm rounded px-2 py-1.5"
                    data-testid="ticket-priority-select"
                  >
                    {PRIORITIES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Status</p>
                  <select
                    value={selected.status}
                    onChange={e => updateTicket(selected.id, { status: e.target.value })}
                    className="w-full bg-[#1a1a1a] border border-gray-600 text-white text-sm rounded px-2 py-1.5"
                    data-testid="ticket-status-select"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                </div>
              </div>

              {/* Thread */}
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {selected.messages?.map((msg, i) => (
                  <div
                    key={msg.id || i}
                    className={`rounded-xl p-3 text-sm ${
                      msg.is_admin
                        ? 'bg-[#0056A8]/20 border border-[#0056A8]/30 ml-4'
                        : 'bg-[#1a1a1a] border border-gray-700 mr-4'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {msg.is_admin ? (
                        <span className="flex items-center gap-1 text-[#60aff0] font-semibold text-xs">
                          Admin <BadgeCheck className="w-3.5 h-3.5 text-[#60aff0]" />
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs font-mono">{msg.sender_id}</span>
                      )}
                      <span className="text-gray-600 text-xs ml-auto">
                        {new Date(msg.created_at).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-gray-200">{msg.message}</p>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              <div className="space-y-2 border-t border-gray-700 pt-4">
                <p className="text-xs text-gray-400">Reply as <strong className="text-white flex items-center gap-1 inline-flex">Admin <BadgeCheck className="w-3 h-3 text-[#60aff0]" /></strong></p>
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  rows={3}
                  className="w-full bg-[#1a1a1a] border border-gray-600 text-white text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-[#0056A8]"
                  data-testid="admin-reply-input"
                />
                <Button
                  onClick={sendReply}
                  disabled={sending || !reply.trim()}
                  className="w-full bg-[#0056A8] hover:bg-[#0066c8] text-white"
                  data-testid="send-reply-btn"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {sending ? 'Sending...' : 'Send Reply'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TicketsTab;
