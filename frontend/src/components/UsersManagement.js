import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UsersManagement({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'User',
    first_name: '',
    last_name: '',
    team_name: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`, {
        params: { admin_token: token }
      });
      setUsers(response.data);
    } catch (error) {
      toast.error('Error loading userave');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser.id}`, formData, {
          params: { admin_token: token }
        });
        toast.success('Useri updated successfully!');
      } else {
        await axios.post(`${API}/users`, formData, {
          params: { admin_token: token }
        });
        toast.success('Useri created successfully!');
      }
      
      fetchUsers();
      setDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error saving userit');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      await axios.delete(`${API}/users/${userId}`, {
        params: { admin_token: token }
      });
      toast.success('Useri deleted successfully!');
      fetchUsers();
    } catch (error) {
      toast.error('Error deleting userit');
    }
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      team_name: user.team_name
    });
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      role: 'User',
      first_name: '',
      last_name: '',
      team_name: ''
    });
  };

  return (
    <Card className="shadow-lg border-0 dark:bg-slate-800 dark:border dark:border-slate-700" data-testid="users-management-card">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-slate-700 dark:to-slate-600 border-b dark:border-slate-700">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold" data-testid="users-title">User Management</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" data-testid="add-user-button">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md dark:bg-slate-800 dark:border-slate-700" data-testid="user-dialog">
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Update Userin' : 'Add User New'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                    <SelectTrigger data-testid="user-role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">Admin</SelectItem>
                      <SelectItem value="User">User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="first_name">Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                    required
                    data-testid="user-firstname-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                    required
                    data-testid="user-lastname-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                    data-testid="user-email-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    required={!editingUser}
                    placeholder={editingUser ? 'Leave blank to keep the same' : ''}
                    data-testid="user-password-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team_name">Team Name</Label>
                  <Input
                    id="team_name"
                    value={formData.team_name}
                    onChange={(e) => setFormData({...formData, team_name: e.target.value})}
                    required
                    data-testid="user-team-input"
                  />
                </div>
                <Button type="submit" className="w-full dark:bg-slate-800" disabled={loading} data-testid="user-submit-button">
                  {loading ? 'Saving...' : (editingUser ? 'Update' : 'Add')}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-4">
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="users-search"
            className="max-w-md"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full dark:bg-slate-800" data-testid="users-table">
            <thead>
              <tr className="border-b dark:border-slate-700">
                <th className="text-left py-3 px-4 font-semibold">Name</th>
                <th className="text-left py-3 px-4 font-semibold">Email</th>
                <th className="text-left py-3 px-4 font-semibold">Role</th>
                <th className="text-left py-3 px-4 font-semibold">Team</th>
                <th className="text-right py-3 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.filter(user => {
                const query = searchQuery.toLowerCase();
                return user.first_name.toLowerCase().includes(query) ||
                       user.last_name.toLowerCase().includes(query) ||
                       user.email.toLowerCase().includes(query) ||
                       user.team_name.toLowerCase().includes(query);
              }).map((user) => (
                <tr key={user.id} className="border-b hover:bg-gray-50 dark:bg-slate-700/50 dark:hover:bg-slate-700 transition-colors" data-testid={`user-row-${user.email}`}>
                  <td className="py-3 px-4">{user.first_name} {user.last_name}</td>
                  <td className="py-3 px-4">{user.email}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      user.role === 'Admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">{user.team_name}</td>
                  <td className="py-3 px-4 text-right space-x-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEdit(user)}
                      data-testid={`edit-user-${user.email}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(user.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`delete-user-${user.email}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
