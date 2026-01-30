import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MicroservicesManagement({ token }) {
  const [microservices, setMicroservices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMs, setEditingMs] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    fetchMicroservices();
  }, []);

  const fetchMicroservices = async () => {
    try {
      const response = await axios.get(`${API}/microservices`);
      setMicroservices(response.data);
    } catch (error) {
      toast.error('Gabim në ngarkimin e mikroserviseve');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingMs) {
        await axios.put(`${API}/microservices/${editingMs.id}`, { name }, {
          params: { admin_token: token }
        });
        toast.success('Mikroservisi u përditësua me sukses!');
      } else {
        await axios.post(`${API}/microservices`, { name }, {
          params: { admin_token: token }
        });
        toast.success('Mikroservisi u krijua me sukses!');
      }
      
      fetchMicroservices();
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gabim në ruajtjen e mikroservisit');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (msId) => {
    if (!window.confirm('Jeni i sigurt që dëshironi të fshini këtë mikroservis?')) return;

    try {
      await axios.delete(`${API}/microservices/${msId}`, {
        params: { admin_token: token }
      });
      toast.success('Mikroservisi u fshi me sukses!');
      fetchMicroservices();
    } catch (error) {
      toast.error('Gabim në fshirjen e mikroservisit');
    }
  };

  const handleEdit = (ms) => {
    setEditingMs(ms);
    setName(ms.name);
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingMs(null);
    setName('');
  };

  return (
    <Card className="shadow-lg border-0" data-testid="microservices-management-card">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold" data-testid="microservices-title">Menaxhimi i Mikroserviseve</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" data-testid="add-microservice-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Microservice
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="microservice-dialog">
              <DialogHeader>
                <DialogTitle>{editingMs ? 'Përditëso Mikroservisin' : 'Add Microservice të Ri'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Emri i Mikroservisit</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    data-testid="microservice-name-input"
                    placeholder="p.sh. Front, Backend, API Gateway"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="microservice-submit-button">
                  {loading ? 'Duke ruajtur...' : (editingMs ? 'Përditëso' : 'Shto')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-4">
          <Input
            placeholder="Kërko mikroservise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="microservices-search"
            className="max-w-md"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {microservices.filter(ms => ms.name.toLowerCase().includes(searchQuery.toLowerCase())).map((ms) => (
            <div 
              key={ms.id} 
              className="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow flex items-center justify-between"
              data-testid={`microservice-item-${ms.name}`}
            >
              <span className="font-medium">{ms.name}</span>
              <div className="flex space-x-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleEdit(ms)}
                  data-testid={`edit-microservice-${ms.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleDelete(ms.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid={`delete-microservice-${ms.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
