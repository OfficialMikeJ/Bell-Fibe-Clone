import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { HardDrive, Plus, Trash2, RefreshCw, Download, Upload, Server, CheckCircle, XCircle, Loader2, ArrowDownToLine, RotateCcw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const BackupTab = ({ token }) => {
  const [servers, setServers] = useState([]);
  const [history, setHistory] = useState([]);
  const [backupStatus, setBackupStatus] = useState({ in_progress: false, log: [] });
  const [loading, setLoading] = useState(false);
  const [addingServer, setAddingServer] = useState(false);
  const [serverAddress, setServerAddress] = useState('');
  const [serverName, setServerName] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [showRestore, setShowRestore] = useState(false);
  const [serverBackups, setServerBackups] = useState([]);
  const [restoreServer, setRestoreServer] = useState('');
  const [restoreFilename, setRestoreFilename] = useState('');

  const logRef = useRef(null);
  const wsRef = useRef(null);
  const [wsLogs, setWsLogs] = useState([]);

  const headers = { Authorization: `Bearer ${token}` };

  const fetchServers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/backup/servers`, { headers });
      setServers(res.data);
      if (res.data.length > 0 && !selectedTarget) {
        const primary = res.data.find(s => s.is_primary);
        setSelectedTarget(primary?.address || res.data[0].address);
      }
    } catch { /* silent */ }
  }, [token, selectedTarget]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/backup/history`, { headers });
      setHistory(res.data);
    } catch { /* silent */ }
  }, [token]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/backup/status`, { headers });
      setBackupStatus(res.data);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    fetchServers();
    fetchHistory();
    fetchStatus();
  }, [fetchServers, fetchHistory, fetchStatus]);

  // WebSocket for live logs
  useEffect(() => {
    const wsUrl = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const connect = () => {
      const ws = new WebSocket(`${wsUrl}/api/backup/ws/logs`);
      ws.onmessage = (e) => {
        setWsLogs(prev => {
          const next = [...prev, e.data];
          return next.length > 200 ? next.slice(-200) : next;
        });
      };
      ws.onclose = () => setTimeout(connect, 3000);
      ws.onerror = () => ws.close();
      wsRef.current = ws;
    };
    connect();
    return () => wsRef.current?.close();
  }, []);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [wsLogs]);

  const handleAddServer = async () => {
    if (!serverAddress) return;
    setDetecting(true);
    try {
      const res = await axios.post(`${API}/backup/servers`, {
        address: serverAddress,
        name: serverName || null
      }, { headers });
      toast.success(`Server "${res.data.name}" added`);
      setServerAddress('');
      setServerName('');
      setAddingServer(false);
      fetchServers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add server');
    } finally {
      setDetecting(false);
    }
  };

  const handleRemoveServer = async (address) => {
    const encoded = address.replace(/\//g, '|');
    try {
      await axios.delete(`${API}/backup/servers/${encoded}`, { headers });
      toast.success('Server removed');
      fetchServers();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove');
    }
  };

  const handleSetPrimary = async (address) => {
    const encoded = address.replace(/\//g, '|');
    try {
      await axios.put(`${API}/backup/servers/${encoded}`, { is_primary: true }, { headers });
      toast.success('Primary server updated');
      fetchServers();
    } catch (err) {
      toast.error('Failed to set primary');
    }
  };

  const handleBackupNow = async () => {
    setLoading(true);
    setWsLogs([]);
    try {
      const res = await axios.post(`${API}/backup/run`, null, {
        headers,
        params: selectedTarget ? { target_address: selectedTarget } : {}
      });
      toast.success(`Backup started — target: ${res.data.target}`);
      // Poll status
      const poll = setInterval(async () => {
        const status = await axios.get(`${API}/backup/status`, { headers });
        setBackupStatus(status.data);
        if (!status.data.in_progress) {
          clearInterval(poll);
          fetchHistory();
          fetchServers();
        }
      }, 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Backup failed to start');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRestore = async (address) => {
    const encoded = address.replace(/\//g, '|');
    setRestoreServer(address);
    try {
      const res = await axios.get(`${API}/backup/server-backups/${encoded}`, { headers });
      setServerBackups(res.data.backups || []);
      setShowRestore(true);
    } catch (err) {
      toast.error('Cannot reach server');
    }
  };

  const handleRestore = async () => {
    if (!restoreFilename) return;
    setWsLogs([]);
    try {
      await axios.post(`${API}/backup/restore`, null, {
        headers,
        params: { server_address: restoreServer, filename: restoreFilename }
      });
      toast.success('Restore started');
      setShowRestore(false);
      const poll = setInterval(async () => {
        const status = await axios.get(`${API}/backup/status`, { headers });
        setBackupStatus(status.data);
        if (!status.data.in_progress) {
          clearInterval(poll);
          fetchHistory();
        }
      }, 3000);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Restore failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <HardDrive className="w-6 h-6 text-[#0056A8]" />
          <h2 className="text-xl font-bold text-white">Backup Management</h2>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { fetchServers(); fetchHistory(); fetchStatus(); }}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700"
            data-testid="refresh-backup-btn"
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
          <Button
            onClick={() => setAddingServer(true)}
            size="sm"
            className="bg-[#0056A8] hover:bg-[#0066c8]"
            data-testid="add-server-btn"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Server
          </Button>
        </div>
      </div>

      {/* Backup Servers */}
      <div className="grid gap-3">
        {servers.length === 0 ? (
          <Card className="bg-[#2a2a2a] border-gray-700">
            <CardContent className="py-8 text-center">
              <Server className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No backup servers configured</p>
              <p className="text-gray-600 text-sm mt-1">Click "Add Server" to connect a backup agent</p>
            </CardContent>
          </Card>
        ) : (
          servers.map((srv) => (
            <Card key={srv.address} className="bg-[#2a2a2a] border-gray-700">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {srv.status === 'online' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-medium">{srv.name}</p>
                        {srv.is_primary && (
                          <span className="text-xs bg-[#0056A8] text-white px-2 py-0.5 rounded">PRIMARY</span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs">{srv.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {srv.disk && (
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">{srv.disk.used_percent}% used</p>
                        <p className="text-gray-600 text-xs">{srv.disk.free_gb} GB free / {srv.disk.total_gb} GB</p>
                        <div className="w-32 h-1.5 bg-gray-700 rounded mt-1">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${srv.disk.used_percent}%`,
                              backgroundColor: srv.disk.used_percent > 85 ? '#ef4444' : srv.disk.used_percent > 70 ? '#f59e0b' : '#22c55e'
                            }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="text-gray-400 text-sm">{srv.backup_count} backups</div>
                    <div className="flex gap-1">
                      {!srv.is_primary && (
                        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white text-xs" onClick={() => handleSetPrimary(srv.address)}>
                          Set Primary
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300" onClick={() => handleOpenRestore(srv.address)} data-testid="restore-btn">
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => handleRemoveServer(srv.address)} data-testid="remove-server-btn">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Backup Controls */}
      {servers.length > 0 && (
        <Card className="bg-[#2a2a2a] border-gray-700">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-gray-400 text-xs mb-1 block">Target Server</Label>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-600 text-white rounded px-3 py-2 text-sm"
                  data-testid="target-server-select"
                >
                  {servers.filter(s => s.status === 'online').map(s => (
                    <option key={s.address} value={s.address}>
                      {s.name} {s.is_primary ? '(Primary)' : ''} — {s.disk?.free_gb || '?'} GB free
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleBackupNow}
                disabled={loading || backupStatus.in_progress}
                className="bg-[#0056A8] hover:bg-[#0066c8] px-8 py-5 text-base font-semibold"
                data-testid="backup-now-btn"
              >
                {backupStatus.in_progress ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Backing up...</>
                ) : (
                  <><ArrowDownToLine className="w-5 h-5 mr-2" /> Backup Now!</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Console Log */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${backupStatus.in_progress ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`} />
            Console Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={logRef}
            className="bg-[#0d0d0d] border border-gray-800 rounded-lg p-3 h-64 overflow-y-auto font-mono text-xs"
            data-testid="backup-console-log"
          >
            {wsLogs.length === 0 ? (
              <p className="text-gray-600">Waiting for backup activity...</p>
            ) : (
              wsLogs.map((line, i) => (
                <div key={i} className={`py-0.5 ${line.includes('ERROR') ? 'text-red-400' : line.includes('WARNING') ? 'text-yellow-400' : line.includes('complete') || line.includes('success') ? 'text-green-400' : 'text-gray-300'}`}>
                  {line}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Backup History */}
      <Card className="bg-[#2a2a2a] border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-sm">Backup History</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-gray-600 text-sm text-center py-4">No backups yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between p-2 bg-[#1a1a1a] rounded text-sm">
                  <div className="flex items-center gap-3">
                    {h.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-white">{h.archive_name}</p>
                      <p className="text-gray-500 text-xs">{h.target_server}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400">{h.size_bytes ? `${(h.size_bytes / (1024*1024)).toFixed(1)} MB` : '—'}</p>
                    <p className="text-gray-600 text-xs">{new Date(h.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Server Dialog */}
      <Dialog open={addingServer} onOpenChange={setAddingServer}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-md" data-testid="add-server-dialog">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-[#0056A8]" />
              Add Backup Server
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-gray-400 text-sm">
              Enter the IP address and port of a server running the StreamVault Backup Agent.
            </p>
            <div className="space-y-2">
              <Label className="text-white">Server Address *</Label>
              <Input
                value={serverAddress}
                onChange={(e) => setServerAddress(e.target.value)}
                placeholder="192.168.1.100:9500"
                className="bg-[#2a2a2a] border-gray-600 text-white"
                data-testid="server-address-input"
              />
              <p className="text-gray-600 text-xs">Format: IP:PORT or hostname:PORT</p>
            </div>
            <div className="space-y-2">
              <Label className="text-white">Friendly Name (optional)</Label>
              <Input
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="e.g. NAS-01"
                className="bg-[#2a2a2a] border-gray-600 text-white"
                data-testid="server-name-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingServer(false)} className="border-gray-600 text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={handleAddServer}
              disabled={detecting || !serverAddress}
              className="bg-[#0056A8] hover:bg-[#0066c8]"
              data-testid="detect-server-btn"
            >
              {detecting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Detecting...</> : 'Add Server'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={showRestore} onOpenChange={setShowRestore}>
        <DialogContent className="bg-[#1a1a1a] border-gray-700 max-w-lg" data-testid="restore-dialog">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-[#0056A8]" />
              Restore from Backup
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Alert className="bg-red-900/20 border-red-900">
              <AlertDescription className="text-red-400 text-sm">
                Restoring will OVERWRITE the current database and media files. This cannot be undone.
              </AlertDescription>
            </Alert>
            {serverBackups.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No backups on this server</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {serverBackups.map((b) => (
                  <div
                    key={b.filename}
                    onClick={() => setRestoreFilename(b.filename)}
                    className={`p-3 rounded cursor-pointer transition-colors ${
                      restoreFilename === b.filename
                        ? 'bg-[#0056A8]/20 border border-[#0056A8]'
                        : 'bg-[#2a2a2a] border border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    <p className="text-white text-sm">{b.filename}</p>
                    <p className="text-gray-500 text-xs">{b.size_mb} MB — {new Date(b.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestore(false)} className="border-gray-600 text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={handleRestore}
              disabled={!restoreFilename}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-restore-btn"
            >
              Restore Selected Backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BackupTab;
