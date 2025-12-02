import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function WorkItemsView({ token, isAdmin, user }) {
  const [workItems, setWorkItems] = useState([]);
  const [microservices, setMicroservices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    work_item_name: '',
    microservices: {},
    environment: '',
    can_temp_branch: false
  });

  useEffect(() => {
    fetchWorkItems();
    fetchMicroservices();
  }, []);

  const fetchWorkItems = async () => {
    try {
      const response = await axios.get(`${API}/work-items`, {
        params: { user_token: token }
      });
      setWorkItems(response.data);
    } catch (error) {
      toast.error('Gabim në ngarkimin e work items');
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
      toast.error('Gabim në ngarkimin e mikroserviseve');
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
        toast.success('Work item u përditësua me sukses!');
      } else {
        await axios.post(`${API}/work-items`, formData, {
          params: { user_token: token }
        });
        toast.success('Work item u krijua me sukses!');
      }
      
      fetchWorkItems();
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gabim në ruajtjen e work item');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Jeni i sigurt që dëshironi të fshini këtë work item?')) return;

    try {
      await axios.delete(`${API}/work-items/${itemId}`, {
        params: { user_token: token }
      });
      toast.success('Work item u fshi me sukses!');
      fetchWorkItems();
    } catch (error) {
      toast.error('Gabim në fshirjen e work item');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      work_item_name: item.work_item_name,
      microservices: item.microservices,
      environment: item.environment || '',
      can_temp_branch: item.can_temp_branch
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
      environment: '',
      can_temp_branch: false
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
              {isAdmin ? 'Të gjitha Work Items' : 'Work Items të mia'}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {new Date().toLocaleDateString('sq-AL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          {!isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600" data-testid="add-work-item-button">
                  <Plus className="w-4 h-4 mr-2" />
                  Shto Work Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="work-item-dialog">
                <DialogHeader>
                  <DialogTitle>{editingItem ? 'Përditëso Work Item' : 'Shto Work Item të Ri'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="work_item_name">Emri i Work Item</Label>
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
                    <Label htmlFor="environment">Environment (opsionale)</Label>
                    <Input
                      id="environment"
                      value={formData.environment}
                      onChange={(e) => setFormData({...formData, environment: e.target.value})}
                      data-testid="work-item-environment-input"
                      placeholder="p.sh. QA, Nightly"
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
                      A mund të bëhet temp me anëtarët e ekipit?
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Mikroserviset</Label>
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
                    {loading ? 'Duke ruajtur...' : (editingItem ? 'Përditëso' : 'Shto')}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="work-items-table">
            <thead>
              <tr className="border-b">
                {isAdmin && <th className="text-left py-3 px-4 font-semibold">User</th>}
                {isAdmin && <th className="text-left py-3 px-4 font-semibold">Ekipi</th>}
                <th className="text-left py-3 px-4 font-semibold">Work Item</th>
                <th className="text-left py-3 px-4 font-semibold">Mikroserviset</th>
                <th className="text-left py-3 px-4 font-semibold">Temp Branch</th>
                <th className="text-right py-3 px-4 font-semibold">Veprime</th>
              </tr>
            </thead>
            <tbody>
              {workItems.map((item) => {
                const selectedMs = Object.entries(item.microservices)
                  .filter(([_, selected]) => selected)
                  .map(([msId, _]) => getMicroserviceName(msId));
                
                return (
                  <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors" data-testid={`work-item-row-${item.work_item_name}`}>
                    {isAdmin && <td className="py-3 px-4">{item.user_name}</td>}
                    {isAdmin && <td className="py-3 px-4">{item.team_name}</td>}
                    <td className="py-3 px-4 font-medium">{item.work_item_name}</td>
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
                      {!isAdmin && (
                        <>
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
                        </>
                      )}
                      {isAdmin && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(item.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          data-testid={`admin-delete-work-item-${item.work_item_name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {workItems.length === 0 && (
            <div className="text-center py-12 text-gray-500" data-testid="no-work-items">
              <p>Nuk ka work items për të ditën e sotme</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
