import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import AppHeader from '@/components/AppHeader';
import { Search, Settings, History, Plus, Trash2, Edit, CheckCircle, XCircle, AlertCircle, Clock, Wifi, WifiOff, HelpCircle, Loader2 } from 'lucide-react';

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
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
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
            <Button variant="outline" onClick={() => {
              setAzureUsername(settings?.azure_username || '');
              setClientId(settings?.client_id || 'sol.web.endpointmanager.pkce');
              setScope(settings?.scope || 'openid profile sol.web.endpointmanager');
              // Set mode based on whether custom OAuth settings exist
              const hasCustomOAuth = settings?.has_client_secret || 
                (settings?.client_id && settings.client_id !== 'sol.web.endpointmanager.pkce');
              setAuthMode(hasCustomOAuth ? 'advanced' : 'simple');
              setShowSettings(true);
            }}>
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
          )}
        </div>

        {/* Configuration Warning */}
        {isAdmin && settings && !settings.is_configured && (
          <Card className="mb-6 border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Azure credentials not configured</p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    Click "Configure" to set up Azure username and password for MDM access.
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

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="dark:bg-slate-800 max-w-md">
          <DialogHeader>
            <DialogTitle>Azure Credentials</DialogTitle>
            <DialogDescription>
              Configure your Azure AD credentials for MDM API access.
            </DialogDescription>
          </DialogHeader>
          
          {/* Auth Mode Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4">
            <button
              onClick={() => setAuthMode('simple')}
              className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                authMode === 'simple'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              data-testid="simple-mode-tab"
            >
              Simple
            </button>
            <button
              onClick={() => setAuthMode('advanced')}
              className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                authMode === 'advanced'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
              data-testid="advanced-mode-tab"
            >
              Advanced OAuth
            </button>
          </div>

          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
            {/* Common fields - Username & Password */}
            <div>
              <Label>Azure Username (Email) *</Label>
              <Input
                type="email"
                value={azureUsername}
                onChange={(e) => setAzureUsername(e.target.value)}
                placeholder="user@company.com"
                className="dark:bg-slate-700"
                data-testid="azure-username-input"
              />
            </div>
            <div>
              <Label>Azure Password *</Label>
              <Input
                type="password"
                value={azurePassword}
                onChange={(e) => setAzurePassword(e.target.value)}
                placeholder="Enter password"
                className="dark:bg-slate-700"
                data-testid="azure-password-input"
              />
            </div>

            {/* Simple Mode Info */}
            {authMode === 'simple' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Simple Mode:</strong> Uses default OAuth client settings. 
                  Switch to Advanced if you need custom client_id or client_secret.
                </p>
              </div>
            )}

            {/* Advanced Mode - OAuth Settings */}
            {authMode === 'advanced' && (
              <>
                <div className="border-t pt-4 mt-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">OAuth Client Settings</p>
                </div>
                <div>
                  <Label>Client ID</Label>
                  <Input
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="sol.web.endpointmanager.pkce"
                    className="dark:bg-slate-700"
                    data-testid="client-id-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">Default: sol.web.endpointmanager.pkce</p>
                </div>
                <div>
                  <Label>Client Secret (Optional)</Label>
                  <Input
                    type="password"
                    value={clientSecret}
                    onChange={(e) => setClientSecret(e.target.value)}
                    placeholder="For confidential clients only"
                    className="dark:bg-slate-700"
                    data-testid="client-secret-input"
                  />
                  <p className="text-xs text-gray-500 mt-1">Required if your client is configured as confidential</p>
                </div>
                <div>
                  <Label>Scope</Label>
                  <Input
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    placeholder="openid profile sol.web.endpointmanager"
                    className="dark:bg-slate-700"
                    data-testid="scope-input"
                  />
                </div>
              </>
            )}

            <Button onClick={saveSettings} disabled={savingSettings} className="w-full" data-testid="save-settings-button">
              {savingSettings ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                authMode === 'simple' ? 'Save Credentials' : 'Save OAuth Settings'
              )}
            </Button>
          </div>
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
