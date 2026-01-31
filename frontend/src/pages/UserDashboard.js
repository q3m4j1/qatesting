import { Button } from '@/components/ui/button';
import WorkItemsView from '../components/WorkItemsView';
import ThemeToggle from '../components/ThemeToggle';

export default function UserDashboard({ user, token, onLogout }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="border-b bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/hellocare-logo.png" alt="HelloCare" className="h-12" />
              <div>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }} data-testid="user-dashboard-title">
                  User Dashboard
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Welcome, {user.first_name} {user.last_name} - {user.team_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button 
                onClick={onLogout} 
                variant="outline" 
                className="hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors"
                data-testid="user-logout-button"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <WorkItemsView token={token} isAdmin={false} user={user} />
      </div>
    </div>
  );
}
