import { useState, useEffect } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { RefreshCw, Sparkles, Trash2, Share2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AssignmentsView({ token }) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchAssignments();
  }, []);

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
        toast.error('Gabim në ngarkimin e shpërndarjes');
      }
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
      toast.success(`Shpërndarja u gjenerua me sukses! ${response.data.length} assignment(e)`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gabim në gjenerimin e shpërndarjes');
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
    <Card className="shadow-lg border-0" data-testid="assignments-card">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold" data-testid="assignments-title">Testing Session Assignments</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex space-x-2">
            <Button 
              onClick={fetchAssignments} 
              variant="outline"
              disabled={loading}
              data-testid="refresh-assignments-button"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
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
          <div className="text-center py-12 text-gray-500" data-testid="no-assignments">
            <Sparkles className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No assignments yet</p>
            <p className="text-sm mt-2">Click "Generate List" to create today's assignments</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAssignments).map(([env, envAssignments]) => (
              <div key={env} className="border rounded-lg overflow-hidden" data-testid={`environment-group-${env}`}>
                <div className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-3">
                  <h3 className="font-bold text-lg">{env}</h3>
                  <p className="text-sm opacity-90">{envAssignments.length} person(a)</p>
                </div>
                <div className="bg-white">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 font-semibold text-sm">User</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Team</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Work Item</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Microservices</th>
                        <th className="text-left py-3 px-4 font-semibold text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {envAssignments.map((assignment, idx) => (
                        <tr 
                          key={idx} 
                          className="border-t hover:bg-gray-50 transition-colors"
                          data-testid={`assignment-row-${assignment.user_name}-${assignment.work_item_name}`}
                        >
                          <td className="py-3 px-4">{assignment.user_name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                              {assignment.team_name}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium">{assignment.work_item_name}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {assignment.microservices.map(ms => (
                                <span key={ms} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                  {ms}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              {assignment.is_temp_branch && (
                                <span className="inline-block px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs">
                                  Temp Branch
                                </span>
                              )}
                              {assignment.conflicts && assignment.conflicts.length > 0 && (
                                <div className="text-xs text-red-600">
                                  Konflikte: {assignment.conflicts.join(', ')}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
