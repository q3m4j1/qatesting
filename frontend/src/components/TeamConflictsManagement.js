import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TeamConflictsManagement({ token }) {
  const [configs, setConfigs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    team_name: '',
    allowed_users: []
  });

  useEffect(() => {
    fetchConfigs();
    fetchUsers();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await axios.get(`${API}/team-conflicts`, {
        params: { admin_token: token }
      });
      setConfigs(response.data);
    } catch (error) {
      toast.error('Error loading configurations');
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`, {
        params: { admin_token: token }
      });
      setUsers(response.data);
    } catch (error) {
      toast.error('Error loading users');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingConfig) {
        await axios.put(`${API}/team-conflicts/${editingConfig.id}`, formData, {
          params: { admin_token: token }
        });
        toast.success('Configuration updated successfully!');
      } else {
        await axios.post(`${API}/team-conflicts`, formData, {
          params: { admin_token: token }
        });
        toast.success('Configuration created successfully!');
      }
      
      fetchConfigs();
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error saving configurationit');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (configId) => {
    if (!window.confirm('Are you sure you want to delete this configuration?')) return;

    try {
      await axios.delete(`${API}/team-conflicts/${configId}`, {
        params: { admin_token: token }
      });
      toast.success('Configuration deleted successfully!');
      fetchConfigs();
    } catch (error) {
      toast.error('Error deleting configurationit');
    }
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setFormData({
      team_name: config.team_name,
      allowed_users: config.allowed_users
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingConfig(null);
    setFormData({
      team_name: '',
      allowed_users: []
    });
  };

  const toggleUser = (userId) => {
    setFormData(prev => ({
      ...prev,
      allowed_users: prev.allowed_users.includes(userId)
        ? prev.allowed_users.filter(id => id !== userId)
        : [...prev.allowed_users, userId]
    }));
  };

  const getTeamUsers = () => {
    return users.filter(u => u.team_name === formData.team_name);
  };

  return (
    <Card className="shadow-lg border-0" data-testid="team-conflicts-management-card">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold" data-testid="team-conflicts-title">Team Configuration for Temporary Branches</CardTitle>
            <p className="text-sm text-gray-600 mt-1">Select members of teams who can work together in the same environment</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" data-testid="add-team-config-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Configuration
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" data-testid="team-config-dialog">
              <DialogHeader>
                <DialogTitle>{editingConfig ? 'Update Configurationn' : 'Add Configuration New'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="team_name">Name i Teamt</Label>
                  <Input
                    id="team_name"
                    value={formData.team_name}
                    onChange={(e) => setFormData({...formData, team_name: e.target.value})}
                    required
                    data-testid="team-name-input"
                    placeholder="p.sh. Team A, Development Team"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Select Anëtarët (who can work together)</Label>
                  <div className="border rounded-md p-4 max-h-64 overflow-y-auto space-y-2">
                    {getTeamUsers().length === 0 ? (
                      <p className="text-sm text-gray-500">No user nga ky ekip</p>
                    ) : (
                      getTeamUsers().map(user => (
                        <div key={user.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={user.id}
                            checked={formData.allowed_users.includes(user.id)}
                            onCheckedChange={() => toggleUser(user.id)}
                            data-testid={`team-user-checkbox-${user.email}`}
                          />
                          <label htmlFor={user.id} className="text-sm cursor-pointer">
                            {user.first_name} {user.last_name} ({user.email})
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="team-config-submit-button">
                  {loading ? 'Saving...' : (editingConfig ? 'Update' : 'Add')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-4">
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="teams-search"
            className="max-w-md"
          />
        </div>
        <div className="space-y-4">
          {configs.filter(config => config.team_name.toLowerCase().includes(searchQuery.toLowerCase())).map((config) => {
            const teamUsers = users.filter(u => config.allowed_users.includes(u.id));
            return (
              <div 
                key={config.id} 
                className="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow"
                data-testid={`team-config-item-${config.team_name}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{config.team_name}</h3>
                    <div className="flex flex-wrap gap-2">
                      {teamUsers.map(user => (
                        <span key={user.id} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {user.first_name} {user.last_name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEdit(config)}
                      data-testid={`edit-team-config-${config.team_name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(config.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`delete-team-config-${config.team_name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
