import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { RefreshCw, Sparkles, Trash2, Share2, AlertTriangle } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AssignmentsView({ token }) {
  const [assignments, setAssignments] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [forceAssignDialog, setForceAssignDialog] = useState(false);
  const [selectedWaitingItem, setSelectedWaitingItem] = useState(null);
  const [selectedEnv, setSelectedEnv] = useState('');
  const [forceAssigning, setForceAssigning] = useState(false);

  useEffect(() => {
    fetchAssignments();
    fetchEnvironments();
  }, []);

  const fetchEnvironments = async () => {
    try {
      const response = await axios.get(`${API}/environments`);
      setEnvironments(response.data);
    } catch (error) {
      console.error('Error loading environments');
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/assignments`, {
        params: { admin_token: token }
      });
      setAssignments(response.data);
    } catch (error) {
      // If no assignments yet, it's okay
      if (error.response?.status !== 404) {
        toast.error('Error loading assignments');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForceAssignClick = (assignment) => {
    setSelectedWaitingItem(assignment);
    setSelectedEnv('');
    setForceAssignDialog(true);
  };

  const handleForceAssign = async () => {
    if (!selectedEnv || !selectedWaitingItem) return;
    
    setForceAssigning(true);
    try {
      const response = await axios.post(`${API}/assignments/force-assign`, {
        user_id: selectedWaitingItem.user_id,
        work_item_name: selectedWaitingItem.work_item_name,
        target_environment: selectedEnv
      }, {
        params: { admin_token: token }
      });
      
      toast.success(`${response.data.user_name} assigned to ${selectedEnv}!`);
      if (response.data.conflicts && response.data.conflicts.length > 0) {
        toast.warning(`Conflicts detected: ${response.data.conflicts.join(', ')}`);
      }
      
      setForceAssignDialog(false);
      setSelectedWaitingItem(null);
      setSelectedEnv('');
      
      // Refresh assignments
      await fetchAssignments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error force assigning');
    } finally {
      setForceAssigning(false);
    }
  };

  const handleRefresh = async () => {
    // When refresh is clicked, check if there are work items that changed
    // and auto-regenerate assignments
    setLoading(true);
    try {
      // First fetch to see if assignments exist
      const assignmentsResponse = await axios.get(`${API}/assignments`, {
        params: { admin_token: token }
      });
      
      if (assignmentsResponse.data && assignmentsResponse.data.length > 0) {
        // Assignments exist, regenerate them
        toast.info('Regenerating assignments with updated work items...');
        await generateAssignments();
      } else {
        // No assignments, just fetch
        await fetchAssignments();
      }
    } catch (error) {
      await fetchAssignments();
    } finally {
      setLoading(false);
    }
  };

  const generateAssignments = async () => {
    setGenerating(true);
    try {
      const response = await axios.post(`${API}/generate-assignments`, null, {
        params: { admin_token: token }
      });
      setAssignments(response.data);
      toast.success(`Assignments generated successfully! ${response.data.length} assignment(s)`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error generating assignments');
    } finally {
      setGenerating(false);
    }
  };

  const deleteAssignments = async () => {
    if (!window.confirm('Are you sure you want to delete today\'s assignments?')) return;

    setLoading(true);
    try {
      await axios.delete(`${API}/assignments`, {
        params: { admin_token: token }
      });
      setAssignments([]);
      toast.success('Assignments deleted successfully!');
    } catch (error) {
      toast.error('Error deleting assignments');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    const today = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    let shareText = `Testing Environment Assignments - ${today}\n`;
    shareText += '='.repeat(50) + '\n\n';
    
    Object.entries(groupedAssignments).forEach(([env, envAssignments]) => {
      shareText += `📍 ${env} (${envAssignments.length} person${envAssignments.length > 1 ? 's' : ''})\n`;
      shareText += '-'.repeat(50) + '\n';
      
      envAssignments.forEach((assignment, idx) => {
        shareText += `${idx + 1}. ${assignment.user_name} (${assignment.team_name})\n`;
        shareText += `   Work Item: ${assignment.work_item_name}\n`;
        shareText += `   Microservices: ${assignment.microservices.join(', ')}\n`;
        if (assignment.is_temp_branch) {
          shareText += `   ⚠️  Temp Branch Mode\n`;
        }
        if (assignment.conflicts && assignment.conflicts.length > 0) {
          shareText += `   ⚠️  Conflicts: ${assignment.conflicts.join(', ')}\n`;
        }
        shareText += '\n';
      });
      shareText += '\n';
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(shareText).then(() => {
      toast.success('Assignments copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  // Group assignments by environment
  const groupedAssignments = assignments.reduce((acc, assignment) => {
    const env = assignment.assigned_environment;
    if (!acc[env]) {
      acc[env] = [];
    }
    acc[env].push(assignment);
    return acc;
  }, {});

  return (
    <Card className="shadow-lg border-0 dark:bg-slate-800 dark:border dark:border-slate-700" data-testid="assignments-card">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-slate-700 dark:to-slate-600 border-b dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold dark:text-white" data-testid="assignments-title">Testing Session Assignments</CardTitle>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={handleRefresh} 
              variant="outline"
              disabled={loading}
              data-testid="refresh-assignments-button"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh & Auto-Update
            </Button>
            {assignments.length > 0 && (
              <>
                <Button 
                  onClick={handleShare}
                  variant="outline"
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  data-testid="share-assignments-button"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Copy & Share
                </Button>
                <Button 
                  onClick={deleteAssignments}
                  disabled={loading}
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid="delete-assignments-button"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Assignments
                </Button>
              </>
            )}
            <Button 
              onClick={generateAssignments}
              disabled={generating}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              data-testid="generate-assignments-button"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {generating ? 'Generating...' : 'Generate List'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {Object.keys(groupedAssignments).length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400" data-testid="no-assignments">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No assignments yet</p>
            <p className="text-sm mt-2">Click "Generate List" to create today's assignments</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAssignments).map(([env, envAssignments]) => {
              const isWaitingList = env === 'WAITING - In Queue';
              
              return (
              <div key={env} className={`border rounded-lg overflow-hidden dark:border-slate-700 ${isWaitingList ? 'border-red-300 dark:border-red-700' : ''}`} data-testid={`environment-group-${env}`}>
                <div className={`text-white px-4 py-3 ${isWaitingList ? 'bg-gradient-to-r from-red-500 to-orange-500 dark:from-red-600 dark:to-orange-600' : 'bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-600 dark:to-purple-600'}`}>
                  <h3 className="font-bold text-lg">{env}</h3>
                  <p className="text-sm opacity-90">{envAssignments.length} person(s)</p>
                </div>
                <div className="bg-white dark:bg-slate-800">
                  <table className="w-full dark:bg-slate-800">
                    <thead className="bg-gray-50 dark:bg-slate-700/50">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-sm dark:text-gray-300">User</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm dark:text-gray-300">Team</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm dark:text-gray-300">Work Item</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm dark:text-gray-300">Microservices</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm dark:text-gray-300">{isWaitingList ? 'Force Assign' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envAssignments.map((assignment, idx) => (
                        <tr 
                          key={idx} 
                          className="border-t hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors dark:border-slate-700"
                          data-testid={`assignment-row-${assignment.user_name}-${assignment.work_item_name}`}
                        >
                          <td className="py-3 px-4 dark:text-gray-300">{assignment.user_name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded text-xs">
                              {assignment.team_name}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium dark:text-gray-200">{assignment.work_item_name}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {assignment.microservices.map(ms => (
                                <span key={ms} className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded text-xs">
                                  {ms}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {isWaitingList ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300"
                                onClick={() => handleForceAssignClick(assignment)}
                                data-testid={`force-assign-${assignment.work_item_name}`}
                              >
                                <AlertTriangle className="w-4 h-4 mr-1" />
                                Force Assign
                              </Button>
                            ) : (
                              <div className="space-y-1">
                                {assignment.is_temp_branch && (
                                  <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 rounded-full text-xs">
                                    Temp Branch
                                  </span>
                                )}
                                {assignment.conflicts && assignment.conflicts.length > 0 && (
                                  <div className="text-xs text-red-600">
                                    Conflicts: {assignment.conflicts.join(', ')}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )})}
          </div>
        )}

        {/* Force Assign Confirmation Dialog */}
        <Dialog open={forceAssignDialog} onOpenChange={setForceAssignDialog}>
          <DialogContent className="max-w-md" data-testid="force-assign-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <AlertTriangle className="w-5 h-5" />
                Force Assign to Environment
              </DialogTitle>
            </DialogHeader>
            
            {selectedWaitingItem && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-slate-700 p-3 rounded-lg">
                  <p className="text-sm font-medium">{selectedWaitingItem.user_name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{selectedWaitingItem.work_item_name}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedWaitingItem.microservices.map(ms => (
                      <span key={ms} className="px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 rounded text-xs">
                        {ms}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Environment:</label>
                  <Select value={selectedEnv} onValueChange={setSelectedEnv}>
                    <SelectTrigger data-testid="force-assign-env-select">
                      <SelectValue placeholder="Choose an environment..." />
                    </SelectTrigger>
                    <SelectContent>
                      {environments.map(env => (
                        <SelectItem key={env.id} value={env.name}>
                          {env.name} {env.is_second ? '(FE only)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-3 rounded-lg">
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    <strong>Warning:</strong> Force assigning may cause conflicts with other users in the same environment. Are you sure you want to proceed?
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setForceAssignDialog(false)}
                disabled={forceAssigning}
              >
                Cancel
              </Button>
              <Button
                onClick={handleForceAssign}
                disabled={!selectedEnv || forceAssigning}
                className="bg-orange-500 hover:bg-orange-600"
                data-testid="confirm-force-assign-button"
              >
                {forceAssigning ? 'Assigning...' : 'Yes, Force Assign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
