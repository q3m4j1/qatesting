import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UsersManagement from '../components/UsersManagement';
import MicroservicesManagement from '../components/MicroservicesManagement';
import EnvironmentsManagement from '../components/EnvironmentsManagement';
import TeamConflictsManagement from '../components/TeamConflictsManagement';
import WorkItemsView from '../components/WorkItemsView';
import AssignmentsView from '../components/AssignmentsView';
import PendingUsersManagement from '../components/PendingUsersManagement';
import AppHeader from '../components/AppHeader';

export default function AdminDashboard({ user, token, onLogout }) {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <AppHeader user={user} onLogout={onLogout} backLabel="Back to Hub" />

      <div className="container mx-auto px-6 py-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6" data-testid="admin-dashboard-title">
          Testing Manager - Admin
        </h1>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white dark:bg-slate-800 shadow-md p-1 rounded-xl grid grid-cols-7 gap-1 dark:border dark:border-slate-700" data-testid="admin-tabs">
            <TabsTrigger value="users" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all dark:text-gray-300 dark:hover:text-white" data-testid="tab-users">Users</TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all dark:text-gray-300 dark:hover:text-white" data-testid="tab-pending">Pending</TabsTrigger>
            <TabsTrigger value="microservices" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all dark:text-gray-300 dark:hover:text-white" data-testid="tab-microservices">Microservices</TabsTrigger>
            <TabsTrigger value="environments" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all dark:text-gray-300 dark:hover:text-white" data-testid="tab-environments">Environments</TabsTrigger>
            <TabsTrigger value="teams" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all dark:text-gray-300 dark:hover:text-white" data-testid="tab-teams">Teams</TabsTrigger>
            <TabsTrigger value="workitems" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all dark:text-gray-300 dark:hover:text-white" data-testid="tab-workitems">Work Items</TabsTrigger>
            <TabsTrigger value="assignments" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white rounded-lg transition-all dark:text-gray-300 dark:hover:text-white" data-testid="tab-assignments">Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="users">
            <UsersManagement token={token} />
          </TabsContent>

          <TabsContent value="pending">
            <PendingUsersManagement token={token} />
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
