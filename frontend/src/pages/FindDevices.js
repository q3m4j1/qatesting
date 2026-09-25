import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { Search, Settings, History, Plus, Trash2, Edit, CheckCircle, XCircle, AlertCircle, Clock, Wifi, WifiOff, HelpCircle, Loader2, Key, ExternalLink, ArrowRightLeft, Repeat, RefreshCw } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_CONFIG = {
  online: { icon: Wifi, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Online' },
  offline: { icon: WifiOff, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Offline' },
  not_registered: { icon: HelpCircle, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Not Registered' },
  checking: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Checking...' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Error' },
  no_access: { icon: XCircle, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'No Access' },
  unreachable: { icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Unreachable' },
  token_expired: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'Token Expired' },
  no_token: { icon: Key, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: 'No Token' },
};

const TOKEN_STATUS_CONFIG = {
  valid: { color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Valid' },
  expiring_soon: { color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Expiring Soon' },
  expired: { color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Expired' },
  no_token: { color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: 'No Token' },
};

const MOVE_STATUS_CONFIG = {
  SENT: { color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Sent (in transit)' },
  VERIFIED: { color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Verified' },
  'SEND-FAILED': { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Send Failed' },
};

function fmtDate(iso) {
  if (!iso) return '';
  try {
    const clean = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
    return new Date(clean).toLocaleString();
  } catch { return iso; }
}

export default function FindDevices({ user, token, onLogout }) {
  const [activeTab, setActiveTab] = useState('search');
  const [environments, setEnvironments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [serial, setSerial] = useState('');
  const [searching, setSearching] = useState(false);
  const [searches, setSearches] = useState([]); // list of search responses
  const [showAllEnvs, setShowAllEnvs] = useState(false);
  const [waitMode, setWaitMode] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const waitRef = useRef(null);

  // Token Management
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [tokenStatuses, setTokenStatuses] = useState([]);
  const [selectedEnvForToken, setSelectedEnvForToken] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  // Environment dialog
  const [showEnvDialog, setShowEnvDialog] = useState(false);
  const [editingEnv, setEditingEnv] = useState(null);
  const [envForm, setEnvForm] = useState({ name: '', display_name: '', switch_key: '', is_active: true, order: 0 });

  // Move dialog
  const [moveDialog, setMoveDialog] = useState(null); // { serial, source, deviceId, deviceName, isOnline }
  const [moveTarget, setMoveTarget] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [moving, setMoving] = useState(false);

  // Move log
  const [moves, setMoves] = useState([]);
  const [checkingMoves, setCheckingMoves] = useState(false);

  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    fetchData();
    return () => { if (waitRef.current) clearInterval(waitRef.current); };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [envsRes, historyRes] = await Promise.all([
        axios.get(`${API}/findenv/environments`, { params: { user_token: token } }),
        axios.get(`${API}/findenv/history`, { params: { user_token: token, limit: 20 } })
      ]);
      setEnvironments(envsRes.data);
      setHistory(historyRes.data);

      if (isAdmin) {
        const settingsRes = await axios.get(`${API}/findenv/settings`, { params: { user_token: token } });
        setSettings(settingsRes.data);
        const tokensRes = await axios.get(`${API}/findenv/tokens`, { params: { user_token: token } });
        setTokenStatuses(tokensRes.data.tokens || []);
        fetchMoves();
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTokenStatuses = async () => {
    try {
      const res = await axios.get(`${API}/findenv/tokens`, { params: { user_token: token } });
      setTokenStatuses(res.data.tokens || []);
    } catch (error) {
      console.error('Error fetching token statuses:', error);
    }
  };

  const fetchMoves = async () => {
    try {
      const res = await axios.get(`${API}/findenv/moves`, { params: { user_token: token, limit: 30 } });
      setMoves(res.data || []);
    } catch (error) {
      console.error('Error fetching moves:', error);
    }
  };

  const parseSerials = () =>
    serial.split(/[\s,;\n]+/).map(s => s.trim().replace(/-/g, '').toUpperCase()).filter(Boolean);

  const runSearch = async () => {
    const serials = parseSerials();
    if (serials.length === 0) {
      toast.error('Please enter at least one serial number');
      return [];
    }
    const res = await axios.post(`${API}/findenv/search-batch`, { serials, show_all: showAllEnvs }, {
      params: { user_token: token }
    });
    return res.data.searches || [];
  };

  const searchDevice = async () => {
    const serials = parseSerials();
    if (serials.length === 0) { toast.error('Please enter at least one serial number'); return; }

    setSearching(true);
    setSearches([]);
    if (waitRef.current) { clearInterval(waitRef.current); setWaiting(false); }

    try {
      const results = await runSearch();
      setSearches(results);
      fetchData();

      const onlineCount = results.filter(r => r.found_online).length;
      if (onlineCount > 0) {
        toast.success(`${onlineCount} of ${results.length} device(s) found online`);
      } else if (results.some(r => r.results.some(x => x.status === 'offline'))) {
        toast.info('Device(s) found but offline');
      } else {
        toast.info('No device found online in any environment');
      }

      // Wait mode: keep polling until all found online
      if (waitMode && onlineCount < results.length) {
        startWaitPolling();
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const startWaitPolling = () => {
    setWaiting(true);
    waitRef.current = setInterval(async () => {
      try {
        const results = await runSearch();
        setSearches(results);
        const allOnline = results.every(r => r.found_online);
        if (allOnline) {
          clearInterval(waitRef.current);
          setWaiting(false);
          toast.success('All devices are now online!');
        }
      } catch (e) { /* keep polling */ }
    }, 10000);
  };

  const stopWaitPolling = () => {
    if (waitRef.current) clearInterval(waitRef.current);
    setWaiting(false);
  };

  // ---- Token management ----
  const saveManualToken = async () => {
    if (!selectedEnvForToken || !manualToken.trim()) { toast.error('Please paste the access token'); return; }
    setSavingToken(true);
    try {
      const res = await axios.post(`${API}/findenv/tokens/${selectedEnvForToken.environment}`, null, {
        params: { user_token: token, access_token: manualToken.trim() }
      });
      toast.success(`Token saved for ${selectedEnvForToken.display_name}! Expires in ${res.data.time_left}`);
      setManualToken('');
      setSelectedEnvForToken(null);
      fetchTokenStatuses();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save token');
    } finally {
      setSavingToken(false);
    }
  };

  const deleteToken = async (envName) => {
    if (!window.confirm('Delete this token? You will need to login again to search this environment.')) return;
    try {
      await axios.delete(`${API}/findenv/tokens/${envName}`, { params: { user_token: token } });
      toast.success('Token deleted');
      fetchTokenStatuses();
    } catch (error) {
      toast.error('Failed to delete token');
    }
  };

  const openMdmLogin = (env) => window.open(env.mdm_url, '_blank');

  // ---- Environments ----
  const saveEnvironment = async () => {
    if (!envForm.name.trim() || !envForm.display_name.trim()) { toast.error('Please fill in all required fields'); return; }
    try {
      const payload = { ...envForm, switch_key: envForm.switch_key.trim() || envForm.name.trim() };
      if (editingEnv) {
        await axios.put(`${API}/findenv/environments/${editingEnv.id}`, payload, { params: { user_token: token } });
        toast.success('Environment updated');
      } else {
        await axios.post(`${API}/findenv/environments`, payload, { params: { user_token: token } });
        toast.success('Environment created');
      }
      setShowEnvDialog(false);
      setEditingEnv(null);
      setEnvForm({ name: '', display_name: '', switch_key: '', is_active: true, order: 0 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save environment');
    }
  };

  const deleteEnvironment = async (envId) => {
    if (!window.confirm('Delete this environment?')) return;
    try {
      await axios.delete(`${API}/findenv/environments/${envId}`, { params: { user_token: token } });
      toast.success('Environment deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete environment');
    }
  };

  const openEditEnv = (env) => {
    setEditingEnv(env);
    setEnvForm({ name: env.name, display_name: env.display_name, switch_key: env.switch_key || env.name, is_active: env.is_active, order: env.order });
    setShowEnvDialog(true);
  };

  // ---- Move ----
  const openMoveDialog = (search) => {
    const dev = search.device || {};
    setMoveDialog({
      serial: search.serial,
      source: search.current_env,
      deviceId: dev.solHelloDeviceId,
      deviceName: dev.name || '',
      isOnline: !!search.found_online,
    });
    setMoveTarget('');
    setMoveReason('');
  };

  const sendMove = async () => {
    if (!moveTarget) { toast.error('Select a target environment'); return; }
    setMoving(true);
    try {
      const res = await axios.post(`${API}/findenv/move`, {
        serials: [moveDialog.serial],
        target_env: moveTarget,
        from_env: moveDialog.source,
        reason: moveReason.trim() || undefined,
        dry_run: false,
      }, { params: { user_token: token } });

      const sent = res.data.sent || [];
      const skipped = res.data.skipped || [];
      if (sent.length && sent[0].status === 'SENT') {
        toast.success(`Move command sent: ${moveDialog.serial} → ${moveTarget.toUpperCase()}. Verifying in Move Log...`);
      } else if (sent.length) {
        toast.error(`Move ${sent[0].status}: ${sent[0].error || ''}`);
      } else if (skipped.length) {
        toast.error(`Skipped: ${skipped[0].reason}`);
      }
      setMoveDialog(null);
      fetchMoves();
      setActiveTab('moves');
      setTimeout(() => checkMoves(true), 12000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Move failed');
    } finally {
      setMoving(false);
    }
  };

  const checkMoves = async (silent = false) => {
    setCheckingMoves(true);
    try {
      const res = await axios.post(`${API}/findenv/moves/check`, null, { params: { user_token: token } });
      fetchMoves();
      if (!silent) {
        const v = res.data.verified?.length || 0;
        toast[v ? 'success' : 'info'](v ? `${v} move(s) verified!` : 'No pending moves verified yet');
      } else if (res.data.verified?.length) {
        toast.success(`${res.data.verified.length} move(s) verified!`);
      }
    } catch (error) {
      if (!silent) toast.error('Failed to check moves');
    } finally {
      setCheckingMoves(false);
    }
  };

  const activeEnvs = environments.filter(e => e.is_active);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading Find Devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50 to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <AppHeader user={user} onLogout={onLogout} backLabel="Back to Hub" />

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Find Hello Devices</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Search & move devices across {activeEnvs.length} active environments
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" data-testid="manage-tokens-btn" onClick={() => { fetchTokenStatuses(); setShowTokenManager(true); }}>
                <Key className="w-4 h-4 mr-2" />
                Manage Tokens
              </Button>
            </div>
          )}
        </div>

        {isAdmin && tokenStatuses.length > 0 && tokenStatuses.every(t => t.status === 'no_token') && (
          <Card className="mb-6 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">No tokens configured</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">Click "Manage Tokens" to login to MDM environments and add access tokens.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="search" className="flex items-center gap-2" data-testid="tab-search"><Search className="w-4 h-4" />Search</TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2" data-testid="tab-history"><History className="w-4 h-4" />History</TabsTrigger>
            {isAdmin && <TabsTrigger value="moves" className="flex items-center gap-2" data-testid="tab-moves"><Repeat className="w-4 h-4" />Move Log</TabsTrigger>}
            {isAdmin && <TabsTrigger value="environments" className="flex items-center gap-2" data-testid="tab-environments"><Settings className="w-4 h-4" />Environments</TabsTrigger>}
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 dark:bg-slate-800 h-fit">
                <CardHeader>
                  <CardTitle>Device Search</CardTitle>
                  <CardDescription>Enter one or more serial numbers (space, comma or new line separated)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Serial Number(s)</Label>
                    <Textarea
                      value={serial}
                      onChange={(e) => setSerial(e.target.value.toUpperCase())}
                      placeholder="e.g., 31A2601120015&#10;A1B2C3D4E5F6G"
                      className="font-mono dark:bg-slate-700 h-24"
                      data-testid="serial-input"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-all" className="text-sm">Show all environments</Label>
                    <Switch id="show-all" checked={showAllEnvs} onCheckedChange={setShowAllEnvs} data-testid="show-all-switch" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="wait-mode" className="text-sm">Wait until online (poll 10s)</Label>
                    <Switch id="wait-mode" checked={waitMode} onCheckedChange={setWaitMode} data-testid="wait-mode-switch" />
                  </div>

                  <Button onClick={searchDevice} disabled={searching} className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="search-button">
                    {searching ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Searching...</>) : (<><Search className="w-4 h-4 mr-2" />Search</>)}
                  </Button>

                  {waiting && (
                    <div className="flex items-center justify-between text-sm text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                      <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Waiting for online...</span>
                      <Button size="sm" variant="ghost" onClick={stopWaitPolling} data-testid="stop-wait-btn">Stop</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="lg:col-span-2 space-y-4">
                {searches.length === 0 ? (
                  <Card className="dark:bg-slate-800">
                    <CardContent className="text-center py-12 text-gray-400">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Enter serial number(s) and click Search</p>
                    </CardContent>
                  </Card>
                ) : (
                  searches.map((search) => (
                    <SearchResultCard
                      key={search.serial}
                      search={search}
                      isAdmin={isAdmin}
                      onMove={() => openMoveDialog(search)}
                    />
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card className="dark:bg-slate-800">
              <CardHeader>
                <CardTitle>Recent Searches</CardTitle>
                <CardDescription>Last 20 device searches</CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-center py-8 text-gray-400">No search history yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
                        onClick={() => { setSerial(item.serial); setActiveTab('search'); }}>
                        <div>
                          <p className="font-mono font-medium dark:text-white">{item.serial}</p>
                          <p className="text-xs text-gray-500">{item.user_name} • {fmtDate(item.searched_at)}</p>
                        </div>
                        <div className="text-right">
                          {item.found_in ? (
                            <span className="text-green-600 dark:text-green-400 text-sm font-medium">Found in {item.found_in}</span>
                          ) : (<span className="text-gray-400 text-sm">Not found</span>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Move Log Tab */}
          {isAdmin && (
            <TabsContent value="moves">
              <Card className="dark:bg-slate-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Move Log</CardTitle>
                      <CardDescription>Environment switch commands sent from this app</CardDescription>
                    </div>
                    <Button variant="outline" onClick={() => checkMoves(false)} disabled={checkingMoves} data-testid="check-moves-btn">
                      {checkingMoves ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Verify Pending
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {moves.length === 0 ? (
                    <p className="text-center py-8 text-gray-400">No moves yet</p>
                  ) : (
                    <div className="space-y-2">
                      {moves.map((m) => {
                        const cfg = MOVE_STATUS_CONFIG[m.status] || { color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30', label: m.status };
                        return (
                          <div key={m.id} className={`p-3 rounded-lg ${cfg.bg}`} data-testid={`move-row-${m.serial}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium dark:text-white">{m.serial}</span>
                                <span className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
                                  {m.from_env?.toUpperCase()} <ArrowRightLeft className="w-3 h-3" /> {m.to_env?.toUpperCase()}
                                </span>
                              </div>
                              <Badge className={`${cfg.color} ${cfg.bg} border-0`}>{cfg.label}</Badge>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {m.by} • {fmtDate(m.created_at)} • {m.reason}
                              {m.error && <span className="text-red-500"> • {m.error}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Environments Tab */}
          {isAdmin && (
            <TabsContent value="environments">
              <Card className="dark:bg-slate-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Environments</CardTitle>
                      <CardDescription>Manage MDM environments & switch keys for device search/move</CardDescription>
                    </div>
                    <Button data-testid="add-env-btn" onClick={() => { setEditingEnv(null); setEnvForm({ name: '', display_name: '', switch_key: '', is_active: true, order: environments.length + 1 }); setShowEnvDialog(true); }}>
                      <Plus className="w-4 h-4 mr-2" />Add Environment
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {environments.map((env) => (
                      <div key={env.id} className={`flex items-center justify-between p-3 rounded-lg ${env.is_active ? 'bg-slate-50 dark:bg-slate-700' : 'bg-gray-100 dark:bg-gray-800 opacity-60'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${env.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <div>
                            <p className="font-medium dark:text-white">{env.display_name}</p>
                            <p className="text-xs text-gray-500 font-mono">{env.mdm_url} • switch key: <span className="font-semibold">{env.switch_key || env.name}</span></p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 mr-4">Order: {env.order}</span>
                          <Button variant="ghost" size="sm" onClick={() => openEditEnv(env)}><Edit className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteEnvironment(env.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Move Dialog */}
      <Dialog open={!!moveDialog} onOpenChange={(o) => !o && setMoveDialog(null)}>
        <DialogContent className="dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-5 h-5" />Move / Switch Environment</DialogTitle>
            <DialogDescription>This sends a REAL change-environment command to MDM.</DialogDescription>
          </DialogHeader>
          {moveDialog && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Serial:</span><span className="font-mono font-medium dark:text-white">{moveDialog.serial}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Device:</span><span className="dark:text-white">{moveDialog.deviceName || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Current env:</span><span className="font-medium dark:text-white">{moveDialog.source?.toUpperCase()} {moveDialog.isOnline ? '(online)' : '(offline)'}</span></div>
              </div>

              {!moveDialog.isOnline && (
                <div className="text-xs bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 p-2 rounded">
                  Device is offline — the command is queued and applies when it next connects.
                </div>
              )}

              <div>
                <Label>Target environment</Label>
                <Select value={moveTarget} onValueChange={setMoveTarget}>
                  <SelectTrigger data-testid="move-target-select"><SelectValue placeholder="Select target environment" /></SelectTrigger>
                  <SelectContent>
                    {activeEnvs.filter(e => e.name !== moveDialog.source).map(e => (
                      <SelectItem key={e.name} value={e.name}>{e.display_name} ({e.switch_key || e.name})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Reason (recorded in MDM)</Label>
                <Input value={moveReason} onChange={(e) => setMoveReason(e.target.value)} placeholder="Optional reason" className="dark:bg-slate-700" data-testid="move-reason-input" />
              </div>

              <div className="flex gap-2">
                <Button onClick={sendMove} disabled={moving || !moveTarget} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-move-btn">
                  {moving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>) : (<>Send Move Command</>)}
                </Button>
                <Button variant="outline" onClick={() => setMoveDialog(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Token Manager Dialog */}
      <Dialog open={showTokenManager} onOpenChange={setShowTokenManager}>
        <DialogContent className="dark:bg-slate-800 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Key className="w-5 h-5" />Manage Access Tokens</DialogTitle>
            <DialogDescription>Login to each MDM environment, copy the access token from browser DevTools, and paste it here.</DialogDescription>
          </DialogHeader>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200 mb-2">How to get an access token:</p>
            <ol className="list-decimal list-inside text-blue-700 dark:text-blue-300 space-y-1">
              <li>Click "Open MDM" to login to the environment</li>
              <li>After logging in, press F12 to open DevTools</li>
              <li>Go to Network tab, find any API request</li>
              <li>Copy the "Authorization: Bearer ..." token value</li>
              <li>Click "Add Token" and paste it here</li>
            </ol>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 mt-4">
            {tokenStatuses.map((env) => {
              const statusConfig = TOKEN_STATUS_CONFIG[env.status] || TOKEN_STATUS_CONFIG.no_token;
              return (
                <div key={env.environment} className={`p-3 rounded-lg border ${statusConfig.bg} dark:border-gray-700`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 dark:text-white">{env.display_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}>{statusConfig.label}</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {env.status === 'valid' && env.time_left_display && <span>Expires in {env.time_left_display}</span>}
                        {env.status === 'expiring_soon' && <span className="text-yellow-600">Expires in {env.time_left_display} - Refresh soon!</span>}
                        {env.status === 'expired' && <span className="text-red-600">Token expired - Please refresh</span>}
                        {env.status === 'no_token' && <span>No token configured</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openMdmLogin(env)} className="text-xs"><ExternalLink className="w-3 h-3 mr-1" />Open MDM</Button>
                      <Button size="sm" variant="outline" onClick={() => { setSelectedEnvForToken(env); setManualToken(''); }} className="text-xs"><Plus className="w-3 h-3 mr-1" />{env.status === 'no_token' ? 'Add' : 'Update'}</Button>
                      {env.status !== 'no_token' && <Button size="sm" variant="ghost" onClick={() => deleteToken(env.environment)} className="text-xs text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {selectedEnvForToken && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-gray-800 dark:text-white mb-2">{selectedEnvForToken.status === 'no_token' ? 'Add' : 'Update'} Token for {selectedEnvForToken.display_name}</h4>
              <Textarea value={manualToken} onChange={(e) => setManualToken(e.target.value)} placeholder="Paste the access token here (starts with 'eyJ...')" className="dark:bg-slate-700 font-mono text-xs h-24" data-testid="manual-token-input" />
              <div className="flex gap-2 mt-2">
                <Button onClick={saveManualToken} disabled={savingToken} className="flex-1">{savingToken ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>) : ('Save Token')}</Button>
                <Button variant="outline" onClick={() => setSelectedEnvForToken(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Environment Dialog */}
      <Dialog open={showEnvDialog} onOpenChange={setShowEnvDialog}>
        <DialogContent className="dark:bg-slate-800">
          <DialogHeader>
            <DialogTitle>{editingEnv ? 'Edit Environment' : 'Add Environment'}</DialogTitle>
            <DialogDescription>Configure an MDM environment for device search & move</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Environment Name (lowercase)</Label>
              <Input value={envForm.name} onChange={(e) => setEnvForm({ ...envForm, name: e.target.value.toLowerCase() })} placeholder="e.g., staging, qa, production" className="dark:bg-slate-700" data-testid="env-name-input" />
              <p className="text-xs text-gray-500 mt-1">Will create: mdm.{envForm.name || 'name'}.solaborate.com</p>
            </div>
            <div>
              <Label>Display Name</Label>
              <Input value={envForm.display_name} onChange={(e) => setEnvForm({ ...envForm, display_name: e.target.value })} placeholder="e.g., Staging, QA, Production" className="dark:bg-slate-700" data-testid="env-display-input" />
            </div>
            <div>
              <Label>Switch Key</Label>
              <Input value={envForm.switch_key} onChange={(e) => setEnvForm({ ...envForm, switch_key: e.target.value.toLowerCase() })} placeholder="Defaults to env name (e.g., staging→preprod)" className="dark:bg-slate-700 font-mono" data-testid="env-switchkey-input" />
              <p className="text-xs text-gray-500 mt-1">The key MDM expects when switching TO this env. Leave blank to use the name.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Order</Label>
                <Input type="number" value={envForm.order} onChange={(e) => setEnvForm({ ...envForm, order: parseInt(e.target.value) || 0 })} className="dark:bg-slate-700" />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label>Active</Label>
                <Switch checked={envForm.is_active} onCheckedChange={(checked) => setEnvForm({ ...envForm, is_active: checked })} />
              </div>
            </div>
            <Button onClick={saveEnvironment} className="w-full" data-testid="save-env-btn">{editingEnv ? 'Update Environment' : 'Add Environment'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Per-serial result card ----
function SearchResultCard({ search, isAdmin, onMove }) {
  const dev = search.device || {};
  const details = search.device_details || {};
  const info = details.deviceInformation || {};
  const net = details.deviceNetwork || {};
  const canMove = isAdmin && !!search.current_env && !!dev.solHelloDeviceId;

  return (
    <Card className="dark:bg-slate-800" data-testid={`result-card-${search.serial}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="font-mono text-lg">{search.serial}</CardTitle>
            <CardDescription>
              {search.found_online ? (
                <span className="text-green-600 dark:text-green-400 font-medium">Online in {search.found_online.toUpperCase()}</span>
              ) : search.last_online_env ? (
                <span className="text-yellow-600 dark:text-yellow-400">Offline • last online in {search.last_online_env.toUpperCase()} ({fmtDate(search.last_online_time)})</span>
              ) : search.current_env ? (
                <span className="text-yellow-600 dark:text-yellow-400">Offline • old records found</span>
              ) : (
                <span className="text-gray-400">Not found online in any environment</span>
              )}
            </CardDescription>
          </div>
          {canMove && (
            <Button size="sm" variant="outline" onClick={onMove} data-testid={`move-btn-${search.serial}`}>
              <ArrowRightLeft className="w-4 h-4 mr-2" />Move
            </Button>
          )}
        </div>
        {search.online_count > 1 && (
          <div className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-900/20 p-2 rounded mt-2">
            ⚠ Online in {search.online_count} environments at once — that shouldn't happen.
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {search.results.map((result) => {
            const config = STATUS_CONFIG[result.status] || STATUS_CONFIG.error;
            const Icon = config.icon;
            return (
              <div key={result.environment} className={`flex items-center justify-between p-2.5 rounded-lg ${config.bg}`}>
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${config.color} ${result.status === 'checking' ? 'animate-spin' : ''}`} />
                  <div>
                    <p className="font-medium text-sm dark:text-white">{result.display_name}</p>
                    <p className="text-xs text-gray-500">{result.environment}{result.http_status ? ` • HTTP ${result.http_status}` : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                  {result.error_message && <p className="text-xs text-gray-500 max-w-[220px] truncate">{result.error_message}</p>}
                </div>
              </div>
            );
          })}
        </div>

        {(search.device_details || dev.name) && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-green-800 dark:text-green-200">Device Details</h4>
              {search.mdm_link && (
                <a href={search.mdm_link} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline flex items-center gap-1" data-testid={`mdm-link-${search.serial}`}>
                  Open in MDM <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Detail label="Where" value={dev.name} />
              <Detail label="Environment" value={details.display_name || search.current_env} />
              <Detail label="Device" value={dev.deviceFamilyName || details.deviceTypeName} />
              <Detail label="Tenant" value={info.tenantName} />
              <Detail label="IP Address" value={net.ipAddress || details.ipAddress} mono />
              <Detail label="WiFi" value={net.ssid} />
            </div>
          </div>
        )}

        {search.last_switch && (
          <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs">
            <p className="font-medium text-gray-700 dark:text-gray-200 mb-1 flex items-center gap-1"><ArrowRightLeft className="w-3 h-3" />Last environment switch (MDM)</p>
            <p className="text-gray-600 dark:text-gray-300">
              {search.last_switch.from_env?.toUpperCase()} → {(search.last_switch.to_display || search.last_switch.to_env || search.last_switch.to_key)?.toUpperCase()}
              {search.last_switch.created_date && ` • ${fmtDate(search.last_switch.created_date)}`}
              {search.last_switch.created_by && ` • by ${search.last_switch.created_by}`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ label, value, mono }) {
  if (value === null || value === undefined || value === '' || value === '-') return null;
  return (
    <div>
      <span className="text-gray-500">{label}:</span>
      <span className={`ml-2 font-medium dark:text-white ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
