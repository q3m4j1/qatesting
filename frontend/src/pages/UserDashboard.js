import WorkItemsView from '../components/WorkItemsView';
import AppHeader from '../components/AppHeader';

export default function UserDashboard({ user, token, onLogout }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <AppHeader user={user} onLogout={onLogout} backLabel="Back to Hub" />

      <div className="container mx-auto px-6 py-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6" data-testid="user-dashboard-title">
          Testing Manager - User
        </h1>
        <WorkItemsView token={token} isAdmin={false} user={user} />
      </div>
    </div>
  );
}
