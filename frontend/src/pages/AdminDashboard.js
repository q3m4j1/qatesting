import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UsersManagement from '../components/UsersManagement';
import MicroservicesManagement from '../components/MicroservicesManagement';
import EnvironmentsManagement from '../components/EnvironmentsManagement';
import TeamConflictsManagement from '../components/TeamConflictsManagement';
import WorkItemsView from '../components/WorkItemsView';
import AssignmentsView from '../components/AssignmentsView';

export default function AdminDashboard({ user, token, onLogout }) {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      <div className="border-b bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent" style={{ fontFamily: 'Space Grotesk, sans-serif' }} data-testid="admin-dashboard-title">
                Admin Dashboard
              </h1>
              <p className="text-sm text-gray-600 mt-1">Mirë se vini, {user.first_name} {user.last_name}</p>
            </div>
            <Button 
              onClick={onLogout} 
              variant="outline" 
              className="hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
              data-testid="admin-logout-button"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white shadow-md p-1 rounded-xl grid grid-cols-6 gap-1" data-testid="admin-tabs">
            <TabsTrigger value="users" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all" data-testid="tab-users">Userët</TabsTrigger>
            <TabsTrigger value="microservices" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all" data-testid="tab-microservices">Microservices</TabsTrigger>
            <TabsTrigger value="environments" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all" data-testid="tab-environments">Mjediset</TabsTrigger>
            <TabsTrigger value="teams" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all" data-testid="tab-teams">Ekipet</TabsTrigger>
            <TabsTrigger value="workitems" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all" data-testid="tab-workitems">Work Items</TabsTrigger>
            <TabsTrigger value="assignments" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all" data-testid="tab-assignments">Shpërndarja</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersManagement token={token} />
          </TabsContent>

          <TabsContent value="microservices">
            <MicroservicesManagement token={token} />
          </TabsContent>

          <TabsContent value="environments">
            <EnvironmentsManagement token={token} />
          </TabsContent>

          <TabsContent value="teams">
            <TeamConflictsManagement token={token} />
          </TabsContent>

          <TabsContent value="workitems">
            <WorkItemsView token={token} isAdmin={true} />
          </TabsContent>

          <TabsContent value="assignments">
            <AssignmentsView token={token} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
