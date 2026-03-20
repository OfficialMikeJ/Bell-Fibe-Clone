import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Activity, Cpu, MemoryStick, Thermometer, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const POLL_MS = 5000; // refresh every 5 seconds

// ── Threshold helpers ─────────────────────────────────────────────────────────
const getLevel = (pct) => {
  if (pct >= 85) return 'critical';
  if (pct >= 65) return 'warn';
  return 'ok';
};

const LEVEL = {
  ok:       { bar: '#22c55e', glow: 'rgba(34,197,94,0.15)',   text: 'text-green-400',  label: 'Normal'   },
  warn:     { bar: '#eab308', glow: 'rgba(234,179,8,0.15)',   text: 'text-yellow-400', label: 'Elevated' },
  critical: { bar: '#ef4444', glow: 'rgba(239,68,68,0.18)',   text: 'text-red-400',    label: 'Critical' },
};

// ── Animated circular gauge ───────────────────────────────────────────────────
const CircleGauge = ({ pct, label, icon: Icon, size = 120 }) => {
  const level  = getLevel(pct);
  const cfg    = LEVEL[level];
  const radius = 44;
  const circ   = 2 * Math.PI * radius;
  const dash   = circ * (pct / 100);

  return (
    <div className="flex flex-col items-center gap-2" data-testid={`health-gauge-${label.toLowerCase()}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Subtle glow behind the gauge */}
        <div className="absolute inset-0 rounded-full"
          style={{ background: cfg.glow, filter: 'blur(10px)', transform: 'scale(0.9)' }} />
        <svg width={size} height={size} viewBox="0 0 100 100" className="relative">
          {/* Track */}
          <circle cx="50" cy="50" r={radius} fill="none"
            stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
          {/* Progress */}
          <circle cx="50" cy="50" r={radius} fill="none"
            stroke={cfg.bar} strokeWidth="7"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={circ / 4}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.7s ease, stroke 0.4s ease' }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold font-mono leading-none ${cfg.text}`}
            style={{ transition: 'color 0.4s ease' }}>
            {Math.round(pct)}
          </span>
          <span className="text-gray-500 text-[10px] mt-0.5">%</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Icon className={`w-3.5 h-3.5 ${cfg.text}`} />
        <span className="text-gray-300 text-sm font-medium">{label}</span>
      </div>
      <span className={`text-[10px] font-medium ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
};

// ── Mini stat box ─────────────────────────────────────────────────────────────
const StatBox = ({ label, value, unit, sub }) => (
  <div className="flex-1 rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
    <div className="text-gray-500 text-xs mb-1">{label}</div>
    <div className="text-white text-xl font-bold font-mono">
      {value}<span className="text-gray-500 text-xs ml-0.5">{unit}</span>
    </div>
    {sub && <div className="text-gray-600 text-[10px] mt-0.5">{sub}</div>}
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
const SystemHealthWidget = ({ token }) => {
  const [metrics,  setMetrics]  = useState(null);
  const [online,   setOnline]   = useState(true);
  const [lastSeen, setLastSeen] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const intervalRef = useRef(null);

  const fetchMetrics = useCallback(async () => {
    setSpinning(true);
    try {
      const res = await axios.get(`${API}/health/metrics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        timeout: 4000,
      });
      setMetrics(res.data);
      setOnline(true);
      setLastSeen(new Date());
    } catch {
      setOnline(false);
    } finally {
      setTimeout(() => setSpinning(false), 400);
    }
  }, [token]);

  useEffect(() => {
    fetchMetrics();
    intervalRef.current = setInterval(fetchMetrics, POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, [fetchMetrics]);

  // Overall status: worst of cpu / ram
  const worstLevel = metrics
    ? [getLevel(metrics.cpu_percent), getLevel(metrics.ram_percent)]
        .reduce((a, b) => {
          const rank = { ok: 0, warn: 1, critical: 2 };
          return rank[a] >= rank[b] ? a : b;
        })
    : 'ok';
  const statusCfg = LEVEL[worstLevel];

  return (
    <div className="bg-[#1e1e1e] rounded-2xl border border-white/5 overflow-hidden"
      data-testid="system-health-widget">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-[#0056A8]" />
          <div>
            <h3 className="text-white font-semibold text-base">Server Health</h3>
            <p className="text-gray-500 text-xs">Live metrics · refreshes every 5 s</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Live status pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: online ? statusCfg.glow : 'rgba(239,68,68,0.1)', border: `1px solid ${online ? statusCfg.bar + '40' : '#ef444440'}` }}>
            {online ? (
              <>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: statusCfg.bar }} />
                <span className={`text-xs font-medium ${statusCfg.text}`}>
                  {worstLevel === 'ok' ? 'All Good' : worstLevel === 'warn' ? 'Elevated' : 'Critical'}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-xs font-medium text-red-400">Offline</span>
              </>
            )}
          </div>
          <button
            onClick={fetchMetrics}
            disabled={spinning}
            data-testid="health-refresh-btn"
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${spinning ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      {!metrics ? (
        <div className="flex items-center justify-center py-16 text-gray-600">
          {online ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-[#0056A8]" />
              <span className="text-sm">Connecting…</span>
            </div>
          ) : (
            <div className="text-center">
              <WifiOff className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Cannot reach the server</p>
            </div>
          )}
        </div>
      ) : (
        <div className="p-6">
          {/* ── Gauges row ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-around gap-4 mb-6">
            <CircleGauge pct={metrics.cpu_percent} label="CPU" icon={Cpu} />
            <CircleGauge pct={metrics.ram_percent} label="RAM" icon={MemoryStick} />
            <CircleGauge pct={metrics.disk_percent ?? 0} label="Disk" icon={Thermometer} />
          </div>

          {/* ── Detail strip ───────────────────────────────────────────────── */}
          <div className="flex gap-3">
            <StatBox
              label="RAM Used"
              value={metrics.ram_used_gb?.toFixed(1)}
              unit="GB"
              sub={`of ${metrics.ram_total_gb?.toFixed(1)} GB total`}
            />
            <StatBox
              label="Load Avg"
              value={metrics.load_avg_1m?.toFixed(2)}
              unit=""
              sub={`5 m: ${metrics.load_avg_5m?.toFixed(2)}`}
            />
            <StatBox
              label="Available RAM"
              value={metrics.ram_available_gb?.toFixed(1)}
              unit="GB"
              sub="free"
            />
            <StatBox
              label="Disk Used"
              value={metrics.disk_used_gb?.toFixed(1)}
              unit="GB"
              sub={`of ${metrics.disk_total_gb?.toFixed(1)} GB`}
            />
          </div>

          {lastSeen && (
            <p className="text-gray-700 text-[10px] mt-4 text-right">
              Last updated: {lastSeen.toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemHealthWidget;
