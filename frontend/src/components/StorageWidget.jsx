import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { HardDrive, RefreshCw, AlertTriangle, CheckCircle, FolderOpen } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Bar colour based on usage level
const LEVEL_STYLES = {
  ok:       { bar: '#22c55e', badge: 'bg-green-900/40 text-green-400 border-green-700/40',  label: 'Healthy'       },
  watch:    { bar: '#eab308', badge: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/40', label: '70% — Watch'  },
  warn:     { bar: '#f97316', badge: 'bg-orange-900/40 text-orange-400 border-orange-700/40', label: '85% — Warning' },
  critical: { bar: '#ef4444', badge: 'bg-red-900/40 text-red-400 border-red-700/40',         label: '95% — Critical' },
};

// Thin stacked bar — each folder gets a proportional slice
const FolderBar = ({ folders, totalDiskBytes }) => {
  const FOLDER_COLORS = [
    '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
    '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#a3a3a3',
  ];
  return (
    <div className="h-2 w-full rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.06)' }}>
      {folders.map((f, i) => {
        const pct = totalDiskBytes > 0 ? (f.bytes / totalDiskBytes) * 100 : 0;
        if (pct < 0.05) return null;
        return (
          <div
            key={f.slug}
            style={{ width: `${pct}%`, background: FOLDER_COLORS[i % FOLDER_COLORS.length] }}
            title={`${f.label}: ${f.human}`}
          />
        );
      })}
    </div>
  );
};

const StorageWidget = ({ token }) => {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [refreshed, setRefreshed] = useState(null); // last refresh timestamp

  const fetchStorage = useCallback(async () => {
    setLoading(true);
    try {
      await axios.get(`${API}/health/storage`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).then(r => {
        setData(r.data);
        setRefreshed(new Date());
      });
    } catch (e) {
      console.error('Storage fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchStorage(); }, [fetchStorage]);

  if (loading && !data) {
    return (
      <div className="bg-[#1e1e1e] rounded-2xl p-6 flex items-center gap-3 text-gray-500" data-testid="storage-widget-loading">
        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-[#0056A8]" />
        <span className="text-sm">Loading storage data…</span>
      </div>
    );
  }

  if (!data) return null;

  const { disk, uploads } = data;
  const level = LEVEL_STYLES[disk.level] || LEVEL_STYLES.ok;
  const FOLDER_COLORS = [
    '#3b82f6','#8b5cf6','#06b6d4','#10b981',
    '#f59e0b','#ec4899','#6366f1','#14b8a6','#a3a3a3',
  ];

  return (
    <div className="space-y-4" data-testid="storage-widget">

      {/* ── Server Disk ── */}
      <div className="bg-[#1e1e1e] rounded-2xl p-6 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-5 h-5 text-[#0056A8]" />
            <h3 className="text-white font-semibold text-base">Server Disk</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${level.badge}`}>
              {disk.level === 'ok' ? <CheckCircle className="w-3 h-3 inline mr-1" /> : <AlertTriangle className="w-3 h-3 inline mr-1" />}
              {level.label}
            </span>
            <button
              onClick={fetchStorage}
              disabled={loading}
              data-testid="storage-refresh-btn"
              className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Big bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1.5">
            <span>Used: <span className="text-white font-medium">{disk.used_human}</span></span>
            <span className="font-mono text-white">{disk.percent}%</span>
            <span>Free: <span className="text-white font-medium">{disk.free_human}</span></span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${disk.percent}%`, background: level.bar }}
              data-testid="disk-usage-bar"
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-1">
            <span>0</span>
            <span>Total: {disk.total_human}</span>
          </div>
        </div>

        {/* Warning message */}
        {disk.level !== 'ok' && (
          <div className="mt-3 flex items-start gap-2 bg-orange-950/30 border border-orange-800/40 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-orange-300 text-xs leading-relaxed">
              {disk.level === 'critical'
                ? 'Disk is critically full. Upload new media or delete old files immediately — the server may stop functioning correctly above 95%.'
                : disk.level === 'warn'
                ? 'Disk is getting full. Consider ordering more drives or removing unused media files soon.'
                : 'Disk is approaching 70%. Worth monitoring — plan for more storage if usage keeps growing.'}
            </p>
          </div>
        )}

        {refreshed && (
          <p className="text-gray-700 text-[10px] mt-3 text-right">
            Last checked: {refreshed.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* ── StreamVault Uploads Breakdown ── */}
      <div className="bg-[#1e1e1e] rounded-2xl p-6 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <FolderOpen className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-white font-semibold text-base">StreamVault Uploads</h3>
              <p className="text-gray-500 text-xs">
                {uploads.total_human} across {uploads.folders.reduce((a, f) => a + f.files, 0)} files
              </p>
            </div>
          </div>
        </div>

        {/* Stacked colour legend bar */}
        <FolderBar folders={uploads.folders} totalDiskBytes={disk.total_bytes} />

        {/* Per-folder rows */}
        <div className="mt-4 space-y-2.5">
          {uploads.folders.map((folder, i) => {
            const pctOfDisk  = disk.total_bytes > 0 ? (folder.bytes / disk.total_bytes) * 100 : 0;
            const pctOfUploads = uploads.total_bytes > 0 ? (folder.bytes / uploads.total_bytes) * 100 : 0;
            const color = FOLDER_COLORS[i % FOLDER_COLORS.length];
            return (
              <div key={folder.slug} data-testid={`storage-folder-${folder.slug}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: color }} />
                    <span className="text-gray-300 text-xs">{folder.label}</span>
                    <span className="text-gray-600 text-[10px]">{folder.files} file{folder.files !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500 text-[10px]">{pctOfDisk.toFixed(2)}% of disk</span>
                    <span className="text-white text-xs font-mono font-medium w-20 text-right">{folder.human}</span>
                  </div>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(pctOfUploads, 100)}%`, background: color, opacity: 0.7 }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {uploads.total_bytes === 0 && (
          <p className="text-gray-600 text-xs text-center py-4">No uploaded files yet</p>
        )}
      </div>

    </div>
  );
};

export default StorageWidget;
