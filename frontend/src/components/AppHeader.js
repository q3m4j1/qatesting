import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle';
import { ArrowLeft, LogOut, Home } from 'lucide-react';

export default function AppHeader({ user, onLogout, showBack = true, backTo = '/home', backLabel = 'Back to Hub' }) {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isHome = location.pathname === '/home';

  return (
    <header className="border-b bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {showBack && !isHome && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(backTo)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
                data-testid="back-button"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{backLabel}</span>
              </Button>
            )}
            <img src="/hellocare-logo.png" alt="HelloCare" className="h-10" />
            {user && (
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-800 dark:text-white">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {user.role === 'Admin' ? '👑 Admin' : '👤 User'} • {user.team_name || 'No Team'}
                </p>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {!isHome && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/home')}
                className="flex items-center gap-2"
                data-testid="home-button"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">Hub</span>
              </Button>
            )}
            <ThemeToggle />
            {onLogout && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onLogout}
                className="flex items-center gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
