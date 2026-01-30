import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Check, X, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PendingUsersManagement({ token }) {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    role: 'User',
    team_name: ''
  });

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    try {
      const response = await axios.get(`${API}/pending-users`, {
        params: { admin_token: token }
      });
      setPendingUsers(response.data);
    } catch (error) {
      toast.error('Error loading pending users');
    }
  };

  const handleApprove = (user) => {
    setSelectedUser(user);
    setFormData({ role: 'User', team_name: '' });
    setDialogOpen(true);
  };

  const confirmApprove = async () => {
    if (!formData.team_name) {
      toast.error('Please enter a team name');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/pending-users/${selectedUser.id}/approve`, formData, {
        params: { admin_token: token }
      });
      toast.success('User approved successfully!');
      setDialogOpen(false);
      fetchPendingUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error approving user');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (userId) => {
    if (!window.confirm('Are you sure you want to reject this user?')) return;

    try {
      await axios.delete(`${API}/pending-users/${userId}`, {
        params: { admin_token: token }
      });
      toast.success('User rejected');
      fetchPendingUsers();
    } catch (error) {
      toast.error('Error rejecting user');
    }
  };

  return (
    <>
      <Card className="shadow-lg border-0" data-testid="pending-users-card">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending User Approvals
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {pendingUsers.length} user(s) awaiting approval
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {pendingUsers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>No pending approvals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingUsers.map((user) => (
                <div 
                  key={user.id} 
                  className="p-4 border rounded-lg bg-white hover:shadow-md transition-shadow flex items-center justify-between"
                  data-testid={`pending-user-${user.email}`}
                >
                  <div className="flex items-center gap-4">
                    {user.picture && (
                      <img src={user.picture} alt={user.name} className="w-12 h-12 rounded-full" />
                    )}
                    <div>
                      <p className="font-semibold">{user.name}</p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Via {user.oauth_provider} • {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleApprove(user)}
                      className="bg-green-500 hover:bg-green-600"
                      data-testid={`approve-${user.email}`}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button 
                      onClick={() => handleReject(user.id)}
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      data-testid={`reject-${user.email}`}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="approve-user-dialog">
          <DialogHeader>
            <DialogTitle>Approve User: {selectedUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({...formData, role: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="User">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Team Name</Label>
              <Input
                value={formData.team_name}
                onChange={(e) => setFormData({...formData, team_name: e.target.value})}
                placeholder="e.g., Development Team"
                required
              />
            </div>
            <Button 
              onClick={confirmApprove} 
              className="w-full" 
              disabled={loading}
            >
              {loading ? 'Approving...' : 'Confirm Approval'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
