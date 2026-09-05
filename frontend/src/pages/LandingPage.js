import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ThemeToggle from '@/components/ThemeToggle';
import { ClipboardList, Tv, Search, LogOut } from 'lucide-react';

export default function LandingPage({ user, onLogout }) {
  const navigate = useNavigate();

  const apps = [
    {
      id: 'testing-manager',
      title: 'Testing Manager',
      description: 'Manage QA testing environments, work items, and daily assignments for your team.',
      icon: ClipboardList,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      available: true,
      path: user?.role === 'Admin' ? '/admin' : '/user'
    },
    {
      id: 'tv-setups',
      title: 'TV Setups',
      description: 'Configure and manage TV display setups across different locations and environments.',
      icon: Tv,
      color: 'from-purple-500 to-pink-500',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      borderColor: 'border-purple-200 dark:border-purple-800',
      available: false,
      path: '/tv-setups'
    },
    {
      id: 'find-devices',
      title: 'Find Hello Devices',
      description: 'Locate and discover Hello devices across different environments and networks.',
      icon: Search,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      available: false,
      path: '/find-devices'
    }
  ];

  const handleCardClick = (app) => {
    if (app.available) {
      navigate(app.path);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <img src="/hellocare-logo.png" alt="HelloCare" className="h-10" />
              <div>
                <h1 className="text-xl font-bold text-gray-800 dark:text-white">HelloCare Hub</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Welcome, {user?.first_name} {user?.last_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                {user?.role === 'Admin' ? '👑 Admin' : '👤 User'}
              </span>
              <ThemeToggle />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onLogout}
                className="flex items-center gap-2"
                data-testid="logout-button"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-white mb-4">
            Choose Your Application
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Select one of the applications below to get started. More tools are coming soon!
          </p>
        </div>

        {/* App Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {apps.map((app) => {
            const IconComponent = app.icon;
            return (
              <Card 
                key={app.id}
                className={`relative overflow-hidden transition-all duration-300 cursor-pointer border-2 ${app.borderColor} ${app.bgColor} 
                  ${app.available 
                    ? 'hover:shadow-xl hover:scale-[1.02] hover:border-opacity-100' 
                    : 'opacity-60 cursor-not-allowed'
                  }`}
                onClick={() => handleCardClick(app)}
                data-testid={`app-card-${app.id}`}
              >
                {/* Gradient Overlay */}
                <div className={`absolute top-0 left-0 right-0 h-2 bg-gradient-to-r ${app.color}`} />
                
                {/* Coming Soon Badge */}
                {!app.available && (
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                      Coming Soon
                    </span>
                  </div>
                )}

                <CardHeader className="pt-8">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${app.color} flex items-center justify-center mb-4 shadow-lg`}>
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-800 dark:text-white">
                    {app.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <CardDescription className="text-gray-600 dark:text-gray-300 text-base leading-relaxed">
                    {app.description}
                  </CardDescription>
                  
                  {app.available && (
                    <Button 
                      className={`w-full mt-6 bg-gradient-to-r ${app.color} hover:opacity-90 text-white font-semibold shadow-md`}
                      data-testid={`open-${app.id}`}
                    >
                      Open Application
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Footer Info */}
        <div className="mt-16 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Need help? Contact your system administrator or the QA team.
          </p>
        </div>
      </main>
    </div>
  );
}
