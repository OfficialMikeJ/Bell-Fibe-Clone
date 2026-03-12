import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, ExternalLink, CheckCircle, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PortalStatus() {
  const [uptimeUrl, setUptimeUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/setup/config`).then(res => {
      setUptimeUrl(res.data.uptime_kuma_url || '');
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Build status page embed URL (Uptime Kuma public status page)
  const embedUrl = uptimeUrl ? (
    uptimeUrl.includes('/status/') ? uptimeUrl : `${uptimeUrl.replace(/\/$/, '')}/status/main`
  ) : '';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-2">
          <Activity className="w-6 h-6 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Service Status</h1>
        <p className="text-gray-500">Real-time status of all services and infrastructure.</p>
      </div>

      {loading && (
        <div className="text-center py-12 text-gray-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
          Loading status page...
        </div>
      )}

      {!loading && !uptimeUrl && (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center space-y-4">
          <Activity className="w-16 h-16 text-gray-300 mx-auto" />
          <h2 className="text-xl font-bold text-gray-700">Status Page Not Configured</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            The service administrator has not configured a status page URL yet.
            Please check back later or contact support directly.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
            If you are experiencing an outage, please submit a support ticket — we'll look into it right away.
          </div>
        </div>
      )}

      {!loading && uptimeUrl && (
        <div className="space-y-4">
          {/* Link to open in new tab */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">Live Status Page</p>
              <p className="text-xs text-gray-400 font-mono truncate max-w-xs">{embedUrl}</p>
            </div>
            <a
              href={embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-[#0056A8] font-medium hover:underline shrink-0"
            >
              Open <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Embedded status page */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-gray-700">Live Status</span>
            </div>
            <iframe
              src={embedUrl}
              title="Service Status"
              className="w-full"
              style={{ height: '600px', border: 'none' }}
              data-testid="status-iframe"
            />
          </div>
        </div>
      )}
    </div>
  );
}
