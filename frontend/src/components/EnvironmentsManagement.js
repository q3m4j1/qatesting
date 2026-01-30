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

export default function EnvironmentsManagement({ token }) {
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEnv, setEditingEnv] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    is_second: false
  });

  useEffect(() => {
    fetchEnvironments();
  }, []);

  const fetchEnvironments = async () => {
    try {
      const response = await axios.get(`${API}/environments`);
      setEnvironments(response.data);
    } catch (error) {
      toast.error('Gabim në ngarkimin e mjediseve');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingEnv) {
        await axios.put(`${API}/environments/${editingEnv.id}`, formData, {
          params: { admin_token: token }
        });
        toast.success('Mjedisi u përditësua me sukses!');
      } else {
        await axios.post(`${API}/environments`, formData, {
          params: { admin_token: token }
        });
        toast.success('Mjedisi u krijua me sukses!');
      }
      
      fetchEnvironments();
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gabim në ruajtjen e mjedisit');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (envId) => {
    if (!window.confirm('Jeni i sigurt që dëshironi të fshini këtë mjedis?')) return;

    try {
      await axios.delete(`${API}/environments/${envId}`, {
        params: { admin_token: token }
      });
      toast.success('Mjedisi u fshi me sukses!');
      fetchEnvironments();
    } catch (error) {
      toast.error('Gabim në fshirjen e mjedisit');
    }
  };

  const handleEdit = (env) => {
    setEditingEnv(env);
    setFormData({
      name: env.name,
      is_second: env.is_second
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingEnv(null);
    setFormData({
      name: '',
      is_second: false
    });
  };

  return (
    <Card className="shadow-lg border-0" data-testid="environments-management-card">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold" data-testid="environments-title">Menaxhimi i Mjediseve</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" data-testid="add-environment-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Environment
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="environment-dialog">
              <DialogHeader>
                <DialogTitle>{editingEnv ? 'Update Mjedisin' : 'Add Environment të Ri'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Emri i Mjedisit</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                    data-testid="environment-name-input"
                    placeholder="p.sh. QA, Nightly, UAT"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_second"
                    checked={formData.is_second}
                    onCheckedChange={(checked) => setFormData({...formData, is_second: checked})}
                    data-testid="environment-second-switch"
                  />
                  <Label htmlFor="is_second" className="cursor-pointer">
                    Mjedis "Second" (vetëm për Front)
                  </Label>
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="environment-submit-button">
                  {loading ? 'Saving...' : (editingEnv ? 'Update' : 'Shto')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-4">
          <Input
            placeholder="Search mjedise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="environments-search"
            className="max-w-md"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {environments.filter(env => env.name.toLowerCase().includes(searchQuery.toLowerCase())).map((env) => (
            <div 
              key={env.id} 
              className="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow"
              data-testid={`environment-item-${env.name}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-lg">{env.name}</h3>
                  {env.is_second && (
                    <span className="inline-block mt-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                      Second Env
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleEdit(env)}
                    data-testid={`edit-environment-${env.name}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(env.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    data-testid={`delete-environment-${env.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
