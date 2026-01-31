import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function WorkItemsView({ token, isAdmin, user }) {
  const [workItems, setWorkItems] = useState([]);
  const [microservices, setMicroservices] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    work_item_name: '',
    microservices: {},
    environment: 'none',
    can_temp_branch: false,
    priority: 2,
    comments: '',
    assigned_user_id: '' // For admin to assign to specific user
  });

  useEffect(() => {
    fetchWorkItems();
    fetchMicroservices();
    fetchEnvironments();
  }, []);

  const fetchWorkItems = async () => {
    try {
      const response = await axios.get(`${API}/work-items`, {
        params: { user_token: token }
      });
      setWorkItems(response.data);
    } catch (error) {
      toast.error('Error loading work items');
    }
  };

  const fetchMicroservices = async () => {
    try {
      const response = await axios.get(`${API}/microservices`);
      setMicroservices(response.data);
      
      // Initialize microservices object with false values
      const msObj = {};
      response.data.forEach(ms => {
        msObj[ms.id] = false;
      });
      setFormData(prev => ({ ...prev, microservices: msObj }));
    } catch (error) {
      toast.error('Error loading microservices');
    }
  };

  const fetchEnvironments = async () => {
    try {
      const response = await axios.get(`${API}/environments`);
      setEnvironments(response.data);
    } catch (error) {
      toast.error('Error loading environments');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingItem) {
        await axios.put(`${API}/work-items/${editingItem.id}`, formData, {
          params: { user_token: token }
        });
        toast.success('Work item updated successfully!');
      } else {
        await axios.post(`${API}/work-items`, formData, {
          params: { user_token: token }
        });
        toast.success('Work item created successfully!');
      }
      
      fetchWorkItems();
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error saving work item');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this work item?')) return;

    try {
      await axios.delete(`${API}/work-items/${itemId}`, {
        params: { user_token: token }
      });
      toast.success('Work item deleted successfully!');
      fetchWorkItems();
    } catch (error) {
      toast.error('Error deleting work item');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      work_item_name: item.work_item_name,
      microservices: item.microservices,
      environment: item.environment || 'none',
      can_temp_branch: item.can_temp_branch,
      priority: item.priority || 2,
      comments: item.comments || ''
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    const msObj = {};
    microservices.forEach(ms => {
      msObj[ms.id] = false;
    });
    setFormData({
      work_item_name: '',
      microservices: msObj,
      environment: 'none',
      can_temp_branch: false,
      priority: 2,
      comments: ''
    });
  };

  const toggleMicroservice = (msId) => {
    setFormData(prev => ({
      ...prev,
      microservices: {
        ...prev.microservices,
        [msId]: !prev.microservices[msId]
      }
    }));
  };

  const getMicroserviceName = (msId) => {
    const ms = microservices.find(m => m.id === msId);
    return ms ? ms.name : msId;
  };

  return (
    <Card className="shadow-lg border-0" data-testid="work-items-card">
      <CardHeader className={`border-b ${isAdmin ? 'bg-gradient-to-r from-blue-50 to-cyan-50' : 'bg-gradient-to-r from-green-50 to-teal-50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold" data-testid="work-items-title">
              {isAdmin ? 'All Work Items' : 'My Work Items'}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600" data-testid="add-work-item-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Work Item
              </Button>
            </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="work-item-dialog">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Update Work Item' : 'Add Work Item New'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="work_item_name">Work Item Name</Label>
                    <Input
                      id="work_item_name"
                      value={formData.work_item_name}
                      onChange={(e) => setFormData({...formData, work_item_name: e.target.value})}
                      required
                      data-testid="work-item-name-input"
                      placeholder="p.sh. Feature-123, Bug-456"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority (1=Highest, 4=Lowest) *</Label>
                    <Select value={formData.priority.toString()} onValueChange={(value) => setFormData({...formData, priority: parseInt(value)})}>
                      <SelectTrigger data-testid="work-item-priority-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Critical</SelectItem>
                        <SelectItem value="2">2 - High</SelectItem>
                        <SelectItem value="3">3 - Medium</SelectItem>
                        <SelectItem value="4">4 - Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="environment">Environment (optional)</Label>
                    <Select value={formData.environment} onValueChange={(value) => setFormData({...formData, environment: value})}>
                      <SelectTrigger data-testid="work-item-environment-select">
                        <SelectValue placeholder="Select environment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Asnjë</SelectItem>
                        {environments.map(env => (
                          <SelectItem key={env.id} value={env.name}>{env.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="comments">Comments (optional)</Label>
                    <textarea
                      id="comments"
                      value={formData.comments}
                      onChange={(e) => setFormData({...formData, comments: e.target.value})}
                      data-testid="work-item-comments-input"
                      placeholder="Add comments or notes..."
                      className="w-full min-h-[80px] px-3 py-2 border rounded-md"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="can_temp_branch"
                      checked={formData.can_temp_branch}
                      onCheckedChange={(checked) => setFormData({...formData, can_temp_branch: checked})}
                      data-testid="work-item-temp-branch-switch"
                    />
                    <Label htmlFor="can_temp_branch" className="cursor-pointer">
                      Can create temp branches with team members?
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Microservices</Label>
                    <div className="border rounded-md p-4 max-h-64 overflow-y-auto grid grid-cols-2 gap-3">
                      {microservices.map(ms => (
                        <div key={ms.id} className="flex items-center space-x-2">
                          <Switch
                            id={ms.id}
                            checked={formData.microservices[ms.id] || false}
                            onCheckedChange={() => toggleMicroservice(ms.id)}
                            data-testid={`microservice-switch-${ms.name}`}
                          />
                          <label htmlFor={ms.id} className="text-sm cursor-pointer">
                            {ms.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading} data-testid="work-item-submit-button">
                    {loading ? 'Saving...' : (editingItem ? 'Update' : 'Add')}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {/* Search Bar */}
        <div className="mb-4">
          <Input
            placeholder="Search work items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="work-items-search"
            className="max-w-md"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" data-testid="work-items-table">
            <thead>
              <tr className="border-b">
                {isAdmin && <th className="text-left py-3 px-4 font-semibold">User</th>}
                {isAdmin && <th className="text-left py-3 px-4 font-semibold">Team</th>}
                <th className="text-left py-3 px-4 font-semibold">Work Item</th>
                <th className="text-left py-3 px-4 font-semibold">Priority</th>
                <th className="text-left py-3 px-4 font-semibold">Assigned Env</th>
                <th className="text-left py-3 px-4 font-semibold">Microservices</th>
                <th className="text-left py-3 px-4 font-semibold">Temp Branch</th>
                <th className="text-right py-3 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {workItems.filter(item => {
                const query = searchQuery.toLowerCase();
                return item.work_item_name.toLowerCase().includes(query) ||
                       item.user_name.toLowerCase().includes(query) ||
                       item.team_name.toLowerCase().includes(query);
              }).map((item) => {
                const selectedMs = Object.entries(item.microservices)
                  .filter(([_, selected]) => selected)
                  .map(([msId, _]) => getMicroserviceName(msId));
                
                return (
                  <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors" data-testid={`work-item-row-${item.work_item_name}`}>
                    {isAdmin && <td className="py-3 px-4">{item.user_name}</td>}
                    {isAdmin && <td className="py-3 px-4">{item.team_name}</td>}
                    <td className="py-3 px-4 font-medium">{item.work_item_name}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        item.priority === 1 ? 'bg-red-100 text-red-700' :
                        item.priority === 2 ? 'bg-orange-100 text-orange-700' :
                        item.priority === 3 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {item.priority === 1 ? 'Critical' :
                         item.priority === 2 ? 'High' :
                         item.priority === 3 ? 'Medium' : 'Low'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {item.assigned_environment ? (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          item.assigned_environment === 'WAITING - Në radhë' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {item.assigned_environment}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {selectedMs.map(ms => (
                          <span key={ms} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                            {ms}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {item.can_temp_branch ? (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Po</span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">Jo</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleEdit(item)}
                        data-testid={`edit-work-item-${item.work_item_name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDelete(item.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-work-item-${item.work_item_name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {workItems.length === 0 && (
            <div className="text-center py-12 text-gray-500" data-testid="no-work-items">
              <p>No work items for today</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
