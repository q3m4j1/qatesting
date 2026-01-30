import { Button } from '@/components/ui/button';
import WorkItemsView from '../components/WorkItemsView';

export default function UserDashboard({ user, token, onLogout }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-green-50 to-teal-50">
      <div className="border-b bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent" style={{ fontFamily: 'Space Grotesk, sans-serif' }} data-testid="user-dashboard-title">
                User Dashboard
              </h1>
              <p className="text-sm text-gray-600 mt-1">Welcome, {user.first_name} {user.last_name} - {user.team_name}</p>
            </div>
            <Button 
              onClick={onLogout} 
              variant="outline" 
              className="hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
              data-testid="user-logout-button"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <WorkItemsView token={token} isAdmin={false} user={user} />
      </div>
    </div>
  );
}
