import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

export default function PendingApprovalPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const message = location.state?.message || 'Your account is awaiting admin approval';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-amber-50 to-orange-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Card className="w-full max-w-md shadow-2xl border-0 dark:bg-slate-800 dark:border dark:border-slate-700">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Clock className="w-9 h-9 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold dark:text-white">Pending Approval</CardTitle>
          <CardDescription className="text-base mt-2 dark:text-gray-300">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600 dark:text-gray-300">
            An administrator will review your request and grant access to the appropriate areas. 
            You will be able to log in once your account has been approved.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This usually takes a few minutes to a few hours.
          </p>
          <Button 
            onClick={() => navigate('/')}
            variant="outline"
            className="w-full mt-4"
          >
            Back to Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
