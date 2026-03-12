import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Video, Trash2, Play, Clock, CheckCircle, XCircle, Circle, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const statusConfig = {
  scheduled: { label: 'Scheduled', color: 'bg-yellow-600', icon: Clock },
  recording: { label: 'Recording', color: 'bg-red-600', icon: Circle },
  completed: { label: 'Completed', color: 'bg-green-600', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-gray-500', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-600', icon: XCircle },
};

const RecordingsPage = ({ userId, username, onBack }) => {
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingRec, setPlayingRec] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestHours, setRequestHours] = useState(100);
  const [requestReason, setRequestReason] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  // Mock user recording hours (in real app, would come from user profile)
  const usedHours = recordings.filter(r => r.status === 'completed').reduce((acc, r) => acc + (r.duration_minutes || 0) / 60, 0);
  const limitHours = 95; // Default
  const remainingHours = Math.max(0, limitHours - usedHours);

  useEffect(() => {
    const fetchRecordings = async () => {
      if (!userId) { setLoading(false); return; }
      try {
        const res = await axios.get(`${API}/recordings/user/${userId}`);
        setRecordings(res.data);
      } catch (e) {
        console.error('Failed to load recordings', e);
      } finally {
        setLoading(false);
      }
    };
    fetchRecordings();
  }, [userId]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this recording?')) return;
    try {
      await axios.delete(`${API}/recordings/${id}`);
      setRecordings(prev => prev.filter(r => r.id !== id));
    } catch (e) { alert('Failed to delete'); }
  };

  const handleSubmitHoursRequest = async () => {
    if (!userId) return;
    setRequestSubmitting(true);
    try {
      await axios.post(`${API}/security/hours-requests`, {
        user_id: userId,
        username: username || userId,
        current_hours: limitHours,
        requested_hours: requestHours,
        reason: requestReason
      });
      setRequestMessage('Your request has been submitted. The administrator will review it shortly.');
      setShowRequestForm(false);
    } catch (e) {
      setRequestMessage(e.response?.data?.detail || 'Failed to submit request');
    } finally {
      setRequestSubmitting(false);
    }
  };

  if (playingRec) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 bg-black/80">
          <h2 className="text-white text-xl font-semibold">{playingRec.program_title}</h2>
          <button onClick={() => setPlayingRec(null)} className="text-white text-2xl hover:text-gray-300 px-4">✕</button>
        </div>
        <div className="flex-1 flex items-center justify-center bg-black">
          {playingRec.file_path ? (
            <video controls autoPlay className="max-w-full max-h-full" src={`${BACKEND_URL}${playingRec.file_path}`} />
          ) : (
            <div className="text-center text-gray-400">
              <Video className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="text-xl">Recording file not available</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#1a1a1a] text-white" data-testid="recordings-page">
      <div className="sticky top-0 z-10 bg-[#1a1a1a]/95 backdrop-blur px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-3xl font-light">My Recordings</h1>
          <button onClick={onBack} className="text-gray-400 hover:text-white text-sm">← Back to Guide</button>
        </div>

        {/* Recording Hours Storage Bar */}
        {userId && (
          <div className="bg-[#2a2a2a] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0056A8]" />
                <span className="text-sm text-gray-300 font-medium">Recording Storage</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  <span className="text-white font-medium">{remainingHours.toFixed(1)}</span> hrs remaining
                  <span className="text-gray-600"> / {limitHours} hrs total</span>
                </span>
                <button onClick={() => setShowRequestForm(true)}
                  className="text-xs bg-[#0056A8] hover:bg-[#0066c8] text-white px-3 py-1 rounded-full flex items-center gap-1 transition-colors">
                  <Plus className="w-3 h-3" /> Request More
                </button>
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div className="h-2.5 rounded-full transition-all bg-[#0056A8]"
                style={{ width: `${Math.min((usedHours / limitHours) * 100, 100)}%` }} />
            </div>
            <p className="text-xs text-gray-500 mt-1">{usedHours.toFixed(1)} hrs used • Max 105 hrs (contact admin to increase)</p>
          </div>
        )}

        {requestMessage && (
          <div className="mt-3 bg-green-900/20 border border-green-700 rounded-lg px-4 py-2 text-green-300 text-sm">
            {requestMessage}
          </div>
        )}
      </div>

      {/* Request More Hours Form */}
      {showRequestForm && (
        <div className="mx-6 mt-4 bg-[#2a2a2a] rounded-xl p-5 border border-gray-700">
          <h3 className="text-white font-medium mb-3">Request More Recording Hours</h3>
          <p className="text-gray-400 text-sm mb-4">Your plan allows up to 105 hours maximum. Enter how many hours you'd like (current: {limitHours} hrs).</p>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex-1">
              <label className="text-gray-300 text-sm block mb-1">Requested Hours (96–105)</label>
              <input type="number" min={96} max={105} value={requestHours}
                onChange={(e) => setRequestHours(parseInt(e.target.value))}
                className="w-full bg-[#1a1a1a] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="mb-4">
            <label className="text-gray-300 text-sm block mb-1">Reason (optional)</label>
            <textarea value={requestReason} onChange={(e) => setRequestReason(e.target.value)}
              placeholder="Why do you need more recording hours?"
              className="w-full bg-[#1a1a1a] border border-gray-600 text-white rounded-lg px-3 py-2 text-sm h-20 resize-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowRequestForm(false)}
              className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm">Cancel</button>
            <button onClick={handleSubmitHoursRequest} disabled={requestSubmitting}
              className="flex-1 py-2 rounded-lg bg-[#0056A8] text-white hover:bg-[#0066c8] text-sm font-medium disabled:opacity-50">
              {requestSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </div>
      )}

      <div className="px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#0056A8]" />
          </div>
        ) : !userId ? (
          <div className="text-center py-20 text-gray-400">
            <Video className="w-20 h-20 mx-auto mb-4 opacity-30" />
            <p className="text-xl mb-2">Device not activated</p>
            <p className="text-sm opacity-60">Activate your device to use Cloud Recording</p>
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Video className="w-20 h-20 mx-auto mb-4 opacity-30" />
            <p className="text-xl mb-2">No recordings yet</p>
            <p className="text-sm opacity-60">Schedule recordings from the program guide</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recordings.map((rec) => {
              const sc = statusConfig[rec.status] || statusConfig.scheduled;
              const Icon = sc.icon;
              const recHours = rec.duration_minutes ? (rec.duration_minutes / 60).toFixed(2) : null;
              return (
                <div key={rec.id} className="bg-[#2a2a2a] rounded-xl p-4 flex items-center gap-4"
                  data-testid={`recording-card-${rec.id}`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${sc.color}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-medium text-base truncate">{rec.program_title}</h3>
                    <div className="flex items-center gap-3 text-xs text-gray-400 mt-1 flex-wrap">
                      {rec.channel_name && <span>{rec.channel_name}</span>}
                      {rec.date && <span>{rec.date}</span>}
                      {rec.start_time && <span>{rec.start_time}</span>}
                      {recHours && <span className="text-gray-300">{recHours} hrs</span>}
                    </div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs text-white ${sc.color}`}>{sc.label}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {rec.status === 'completed' && (
                      <button onClick={() => setPlayingRec(rec)}
                        className="w-10 h-10 rounded-full bg-[#0056A8] flex items-center justify-center hover:bg-[#0066c8]">
                        <Play className="w-5 h-5 text-white ml-0.5" />
                      </button>
                    )}
                    <button onClick={() => handleDelete(rec.id)}
                      className="w-10 h-10 rounded-full bg-red-900/40 flex items-center justify-center hover:bg-red-800">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecordingsPage;
