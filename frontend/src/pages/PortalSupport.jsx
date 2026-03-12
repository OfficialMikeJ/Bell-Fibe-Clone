import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MessageSquare, Send, CheckCircle, Loader, AlertCircle, Ticket } from 'lucide-react';
import { usePortal } from './PortalLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const TICKET_TYPES = [
  'General Support',
  'Streaming/VOD Support',
  'Android App Support',
  'Previous Recordings Not Displaying',
  'Saved Programs Not Showing',
  'Network Errors/Service Status',
];

export default function PortalSupport() {
  const { session } = usePortal();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', ticket_type: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const [error, setError] = useState('');
  const [myTickets, setMyTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [activeView, setActiveView] = useState('submit'); // submit | my-tickets

  useEffect(() => {
    if (session && activeView === 'my-tickets') {
      fetchMyTickets();
    }
  }, [session, activeView]);

  const fetchMyTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await axios.get(`${API}/tickets/by-user/${session.user_id}`);
      setMyTickets(res.data);
    } catch {} finally {
      setLoadingTickets(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session) { navigate('/portal'); return; }
    if (!form.title || !form.description || !form.ticket_type) {
      setError('Please fill in all fields.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await axios.post(`${API}/tickets`, {
        title: form.title,
        description: form.description,
        ticket_type: form.ticket_type,
        user_id: session.user_id,
      });
      setTicketId(res.data.id);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusColors = {
    open: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  };

  if (!session) {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <MessageSquare className="w-16 h-16 text-gray-300 mx-auto" />
        <h2 className="text-xl font-bold text-gray-800">Sign In Required</h2>
        <p className="text-gray-500">Please sign in with your activation code to submit a support ticket.</p>
        <button
          onClick={() => navigate('/portal')}
          className="bg-[#0056A8] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0066c8] transition-colors"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-2">
          <MessageSquare className="w-6 h-6 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Support Tickets</h1>
        <p className="text-gray-500">Submit a new ticket or view your existing ones.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        {['submit', 'my-tickets'].map(v => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {v === 'submit' ? 'New Ticket' : 'My Tickets'}
          </button>
        ))}
      </div>

      {/* Submit form */}
      {activeView === 'submit' && (
        <>
          {submitted ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <h2 className="text-xl font-bold text-gray-900">Ticket Submitted!</h2>
              <p className="text-gray-500 text-sm">We've received your request and will respond shortly.</p>
              <div className="bg-gray-50 rounded-xl p-3 text-left">
                <p className="text-xs text-gray-500">Ticket Reference</p>
                <code className="text-sm font-mono text-gray-900">{ticketId}</code>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setSubmitted(false); setForm({ title: '', description: '', ticket_type: '' }); }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
                >
                  Submit Another
                </button>
                <button
                  onClick={() => setActiveView('my-tickets')}
                  className="flex-1 bg-[#0056A8] text-white py-2.5 rounded-xl text-sm font-medium hover:bg-[#0066c8]"
                >
                  View My Tickets
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Issue Type</label>
                <select
                  value={form.ticket_type}
                  onChange={e => setForm({ ...form, ticket_type: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8]"
                  required
                  data-testid="ticket-type-select"
                >
                  <option value="">Select an issue type</option>
                  {TICKET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Brief description of your issue"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8]"
                  required
                  data-testid="ticket-title-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Details</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Please describe the issue in detail. Include what you were doing when it occurred."
                  rows={5}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0056A8] resize-none"
                  required
                  data-testid="ticket-description-input"
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#0056A8] text-white py-3 rounded-xl font-semibold hover:bg-[#0066c8] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                data-testid="submit-ticket-btn"
              >
                {submitting ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </form>
          )}
        </>
      )}

      {/* My tickets */}
      {activeView === 'my-tickets' && (
        <div className="space-y-3">
          {loadingTickets && <div className="text-center py-8 text-gray-400">Loading tickets...</div>}
          {!loadingTickets && myTickets.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
              <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No tickets yet. Submit one above if you need help.</p>
            </div>
          )}
          {myTickets.map(ticket => (
            <div key={ticket.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium text-gray-900">{ticket.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ticket.ticket_type}</p>
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${statusColors[ticket.status] || 'bg-gray-100 text-gray-600'}`}>
                  #{ticket.status.replace('_', '-')}
                </span>
              </div>
              <p className="text-sm text-gray-500 line-clamp-2">{ticket.description}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  {new Date(ticket.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
                <p className="text-xs text-gray-400">{ticket.messages?.length || 0} messages</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
