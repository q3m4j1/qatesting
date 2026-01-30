import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AuthCallback({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double execution in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = location.hash;
        const params = new URLSearchParams(hash.substring(1));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          toast.error('Authentication failed: No session ID');
          navigate('/');
          return;
        }

        // Exchange session_id for user data
        const response = await axios.post(`${API}/auth/oauth/exchange`, {
          session_id: sessionId
        }, {
          withCredentials: true  // Important for cookies
        });

        if (response.data.status === 'approved') {
          // User is approved, log them in
          toast.success('Successfully logged in!');
          onLogin(response.data.user, response.data.user.id);
          
          // Navigate based on role
          if (response.data.user.role === 'Admin') {
            navigate('/admin');
          } else {
            navigate('/user');
          }
        } else if (response.data.status === 'pending') {
          // User is pending approval
          toast.info(response.data.message);
          navigate('/pending-approval', { 
            state: { message: response.data.message }
          });
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        toast.error(error.response?.data?.detail || 'Authentication failed');
        navigate('/');
      }
    };

    processCallback();
  }, [location, navigate, onLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Completing authentication...</p>
      </div>
    </div>
  );
}
