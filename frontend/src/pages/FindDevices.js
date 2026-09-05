import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { Search, Settings, History, Plus, Trash2, Edit, CheckCircle, XCircle, AlertCircle, Clock, Wifi, WifiOff, HelpCircle, Loader2, Key, ExternalLink, RefreshCw, Copy } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const STATUS_CONFIG = {
  online: { icon: Wifi, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30', label: 'Online' },
  offline: { icon: WifiOff, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Offline' },
  not_registered: { icon: HelpCircle, color: 'text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Not Registered' },
  checking: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', label: 'Checking...' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Error' },
  no_access: { icon: XCircle, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'No Access' },
  auth_failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Auth Failed' },
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

export default function FindDevices({ user, token, onLogout }) {
  const [activeTab, setActiveTab] = useState('search');
  const [environments, setEnvironments] = useState([]);
  const [settings, setSettings] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [serial, setSerial] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [showAllEnvs, setShowAllEnvs] = useState(false);
  
  // Settings dialog
  const [showSettings, setShowSettings] = useState(false);
  const [authMode, setAuthMode] = useState('simple'); // 'simple' or 'advanced'
  const [azureUsername, setAzureUsername] = useState('');
  const [azurePassword, setAzurePassword] = useState('');
  const [clientId, setClientId] = useState('sol.web.endpointmanager.pkce');
  const [clientSecret, setClientSecret] = useState('');
  const [scope, setScope] = useState('openid profile sol.web.endpointmanager');
  const [savingSettings, setSavingSettings] = useState(false);
  
  // Token Management
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [tokenStatuses, setTokenStatuses] = useState([]);
  const [selectedEnvForToken, setSelectedEnvForToken] = useState(null);
  const [manualToken, setManualToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  
  // Environment dialog
  const [showEnvDialog, setShowEnvDialog] = useState(false);
  const [editingEnv, setEditingEnv] = useState(null);
  const [envForm, setEnvForm] = useState({ name: '', display_name: '', is_active: true, order: 0 });

  const isAdmin = user?.role === 'Admin';

  useEffect(() => {
    fetchData();
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
        // Also fetch token statuses
        const tokensRes = await axios.get(`${API}/findenv/tokens`, { params: { user_token: token } });
        setTokenStatuses(tokensRes.data.tokens || []);
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

  const saveManualToken = async () => {
    if (!selectedEnvForToken || !manualToken.trim()) {
      toast.error('Please paste the access token');
      return;
    }

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

  const openMdmLogin = (env) => {
    window.open(env.mdm_url, '_blank');
  };

  const searchDevice = async () => {
    if (!serial.trim()) {
      toast.error('Please enter a serial number');
      return;
    }

    setSearching(true);
    setSearchResults(null);

    try {
      const res = await axios.get(`${API}/findenv/search/${serial.trim()}`, {
        params: { user_token: token, show_all: showAllEnvs }
      });
      setSearchResults(res.data);
      fetchData(); // Refresh history
      
      if (res.data.found_online) {
        toast.success(`Device found online in ${res.data.found_online}!`);
      } else if (res.data.results.some(r => r.status === 'offline')) {
        toast.info('Device found but offline');
      } else {
        toast.info('Device not found in any environment');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const saveSettings = async () => {
    if (!azureUsername.trim() || !azurePassword.trim()) {
      toast.error('Please enter both username and password');
      return;
    }

    setSavingSettings(true);
    try {
      // In simple mode, use defaults; in advanced mode, use user-provided values
      const settingsParams = {
        user_token: token,
        azure_username: azureUsername.trim(),
        azure_password: azurePassword
      };

      if (authMode === 'advanced') {
        settingsParams.client_id = clientId.trim();
        settingsParams.client_secret = clientSecret.trim() || null;
        settingsParams.scope = scope.trim();
      }
      // Simple mode uses server defaults (no client_id/secret/scope params sent)

      await axios.post(`${API}/findenv/settings`, null, { params: settingsParams });
      toast.success(authMode === 'simple' ? 'Credentials saved successfully' : 'OAuth settings saved successfully');
      setShowSettings(false);
      setAzurePassword('');
      setClientSecret('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const saveEnvironment = async () => {
    if (!envForm.name.trim() || !envForm.display_name.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingEnv) {
        await axios.put(`${API}/findenv/environments/${editingEnv.id}`, envForm, {
          params: { user_token: token }
        });
        toast.success('Environment updated');
      } else {
        await axios.post(`${API}/findenv/environments`, envForm, {
          params: { user_token: token }
        });
        toast.success('Environment created');
      }
      setShowEnvDialog(false);
      setEditingEnv(null);
      setEnvForm({ name: '', display_name: '', is_active: true, order: 0 });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save environment');
    }
  };

  const deleteEnvironment = async (envId) => {
    if (!window.confirm('Delete this environment?')) return;

    try {
      await axios.delete(`${API}/findenv/environments/${envId}`, {
        params: { user_token: token }
      });
      toast.success('Environment deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete environment');
    }
  };

  const openEditEnv = (env) => {
    setEditingEnv(env);
    setEnvForm({
      name: env.name,
      display_name: env.display_name,
      is_active: env.is_active,
      order: env.order
    });
    setShowEnvDialog(true);
  };

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
              Search for devices across {environments.filter(e => e.is_active).length} active environments
            </p>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                fetchTokenStatuses();
                setShowTokenManager(true);
              }}>
                <Key className="w-4 h-4 mr-2" />
                Manage Tokens
              </Button>
            </div>
          )}
        </div>

        {/* Token Warning */}
        {isAdmin && tokenStatuses.length > 0 && tokenStatuses.every(t => t.status === 'no_token') && (
          <Card className="mb-6 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">No tokens configured</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Click "Manage Tokens" to login to MDM environments and add access tokens.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="environments" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Environments
              </TabsTrigger>
            )}
          </TabsList>

          {/* Search Tab */}
          <TabsContent value="search">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Search Form */}
              <Card className="lg:col-span-1 dark:bg-slate-800">
                <CardHeader>
                  <CardTitle>Device Search</CardTitle>
                  <CardDescription>Enter a serial number to find the device</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Serial Number</Label>
                    <Input
                      value={serial}
                      onChange={(e) => setSerial(e.target.value.toUpperCase())}
                      placeholder="e.g., A1B2C3D4E5"
                      className="font-mono dark:bg-slate-700"
                      onKeyDown={(e) => e.key === 'Enter' && searchDevice()}
                      data-testid="serial-input"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label htmlFor="show-all" className="text-sm">Show all environments</Label>
                    <Switch
                      id="show-all"
                      checked={showAllEnvs}
                      onCheckedChange={setShowAllEnvs}
                    />
                  </div>

                  <Button 
                    onClick={searchDevice} 
                    disabled={searching || !settings?.is_configured}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    data-testid="search-button"
                  >
                    {searching ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Search
                      </>
                    )}
                  </Button>

                  {!settings?.is_configured && (
                    <p className="text-xs text-center text-gray-500">
                      Admin must configure Azure credentials first
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Results */}
              <Card className="lg:col-span-2 dark:bg-slate-800">
                <CardHeader>
                  <CardTitle>Search Results</CardTitle>
                  {searchResults && (
                    <CardDescription>
                      Serial: <span className="font-mono font-bold">{searchResults.serial}</span>
                      {searchResults.found_online && (
                        <span className="ml-2 text-green-600 dark:text-green-400">
                          • Found online in {searchResults.found_online}
                        </span>
                      )}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {!searchResults ? (
                    <div className="text-center py-12 text-gray-400">
                      <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Enter a serial number and click Search</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {searchResults.results.map((result) => {
                        const config = STATUS_CONFIG[result.status] || STATUS_CONFIG.error;
                        const Icon = config.icon;
                        
                        return (
                          <div
                            key={result.environment}
                            className={`flex items-center justify-between p-3 rounded-lg ${config.bg}`}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={`w-5 h-5 ${config.color} ${result.status === 'checking' ? 'animate-spin' : ''}`} />
                              <div>
                                <p className="font-medium dark:text-white">{result.display_name}</p>
                                <p className="text-xs text-gray-500">{result.environment}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
                              {result.error_message && (
                                <p className="text-xs text-gray-500">{result.error_message}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Device Details */}
                  {searchResults?.device_details && (
                    <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Device Details</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Model:</span>
                          <span className="ml-2 font-medium dark:text-white">{searchResults.device_details.deviceTypeName || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Environment:</span>
                          <span className="ml-2 font-medium dark:text-white">{searchResults.device_details.display_name}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Firmware:</span>
                          <span className="ml-2 font-medium dark:text-white">{searchResults.device_details.firmwareVersion || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">IP Address:</span>
                          <span className="ml-2 font-mono dark:text-white">{searchResults.device_details.ipAddress || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
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
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600"
                        onClick={() => {
                          setSerial(item.serial);
                          setActiveTab('search');
                        }}
                      >
                        <div>
                          <p className="font-mono font-medium dark:text-white">{item.serial}</p>
                          <p className="text-xs text-gray-500">{item.user_name} • {new Date(item.searched_at).toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          {item.found_in ? (
                            <span className="text-green-600 dark:text-green-400 text-sm font-medium">
                              Found in {item.found_in}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-sm">Not found</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Environments Tab (Admin only) */}
          {isAdmin && (
            <TabsContent value="environments">
              <Card className="dark:bg-slate-800">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Environments</CardTitle>
                      <CardDescription>Manage MDM environments for device search</CardDescription>
                    </div>
                    <Button onClick={() => {
                      setEditingEnv(null);
                      setEnvForm({ name: '', display_name: '', is_active: true, order: environments.length + 1 });
                      setShowEnvDialog(true);
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Environment
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {environments.map((env) => (
                      <div
                        key={env.id}
                        className={`flex items-center justify-between p-3 rounded-lg ${env.is_active ? 'bg-slate-50 dark:bg-slate-700' : 'bg-gray-100 dark:bg-gray-800 opacity-60'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${env.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                          <div>
                            <p className="font-medium dark:text-white">{env.display_name}</p>
                            <p className="text-xs text-gray-500 font-mono">{env.mdm_url}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 mr-4">Order: {env.order}</span>
                          <Button variant="ghost" size="sm" onClick={() => openEditEnv(env)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteEnvironment(env.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
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

      {/* Token Manager Dialog */}
      <Dialog open={showTokenManager} onOpenChange={setShowTokenManager}>
        <DialogContent className="dark:bg-slate-800 max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Manage Access Tokens
            </DialogTitle>
            <DialogDescription>
              Login to each MDM environment, copy the access token from browser DevTools, and paste it here.
            </DialogDescription>
          </DialogHeader>
          
          {/* Instructions */}
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

          {/* Token List */}
          <div className="flex-1 overflow-y-auto space-y-2 mt-4">
            {tokenStatuses.map((env) => {
              const statusConfig = TOKEN_STATUS_CONFIG[env.status] || TOKEN_STATUS_CONFIG.no_token;
              return (
                <div key={env.environment} className={`p-3 rounded-lg border ${statusConfig.bg} dark:border-gray-700`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 dark:text-white">{env.display_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {env.status === 'valid' && env.time_left_display && (
                          <span>Expires in {env.time_left_display}</span>
                        )}
                        {env.status === 'expiring_soon' && (
                          <span className="text-yellow-600">Expires in {env.time_left_display} - Refresh soon!</span>
                        )}
                        {env.status === 'expired' && (
                          <span className="text-red-600">Token expired - Please refresh</span>
                        )}
                        {env.status === 'no_token' && (
                          <span>No token configured</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openMdmLogin(env)}
                        className="text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open MDM
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedEnvForToken(env);
                          setManualToken('');
                        }}
                        className="text-xs"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        {env.status === 'no_token' ? 'Add' : 'Update'}
                      </Button>
                      {env.status !== 'no_token' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteToken(env.environment)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add/Update Token Section */}
          {selectedEnvForToken && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-gray-800 dark:text-white mb-2">
                {selectedEnvForToken.status === 'no_token' ? 'Add' : 'Update'} Token for {selectedEnvForToken.display_name}
              </h4>
              <Textarea
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="Paste the access token here (starts with 'eyJ...')"
                className="dark:bg-slate-700 font-mono text-xs h-24"
                data-testid="manual-token-input"
              />
              <div className="flex gap-2 mt-2">
                <Button onClick={saveManualToken} disabled={savingToken} className="flex-1">
                  {savingToken ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Token'
                  )}
                </Button>
                <Button variant="outline" onClick={() => setSelectedEnvForToken(null)}>
                  Cancel
                </Button>
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
            <DialogDescription>
              Configure an MDM environment for device search
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Environment Name (lowercase)</Label>
              <Input
                value={envForm.name}
                onChange={(e) => setEnvForm({...envForm, name: e.target.value.toLowerCase()})}
                placeholder="e.g., staging, qa, production"
                className="dark:bg-slate-700"
              />
              <p className="text-xs text-gray-500 mt-1">
                Will create: mdm.{envForm.name || 'name'}.solaborate.com
              </p>
            </div>
            <div>
              <Label>Display Name</Label>
              <Input
                value={envForm.display_name}
                onChange={(e) => setEnvForm({...envForm, display_name: e.target.value})}
                placeholder="e.g., Staging, QA, Production"
                className="dark:bg-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Order</Label>
                <Input
                  type="number"
                  value={envForm.order}
                  onChange={(e) => setEnvForm({...envForm, order: parseInt(e.target.value) || 0})}
                  className="dark:bg-slate-700"
                />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label>Active</Label>
                <Switch
                  checked={envForm.is_active}
                  onCheckedChange={(checked) => setEnvForm({...envForm, is_active: checked})}
                />
              </div>
            </div>
            <Button onClick={saveEnvironment} className="w-full">
              {editingEnv ? 'Update Environment' : 'Add Environment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
