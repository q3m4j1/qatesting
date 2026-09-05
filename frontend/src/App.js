import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import AdminDashboard from "./pages/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";
import AuthCallback from "./pages/AuthCallback";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/contexts/ThemeContext";

function AppRouter({ user, onLogin, onLogout }) {
  const location = useLocation();
  
  // Check for OAuth callback BEFORE rendering routes
  if (location.hash?.includes('session_id=')) {
    return <AuthCallback onLogin={onLogin} />;
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          user ? 
            <Navigate to="/home" replace /> : 
            <LoginPage onLogin={onLogin} />
        } 
      />
      <Route 
        path="/home" 
        element={
          user ? 
            <LandingPage user={user} onLogout={onLogout} /> : 
            <Navigate to="/" replace />
        } 
      />
      <Route path="/pending-approval" element={<PendingApprovalPage />} />
      <Route 
        path="/admin" 
        element={
          user && user.role === 'Admin' ? 
            <AdminDashboard user={user} token={user.id} onLogout={onLogout} /> : 
            <Navigate to="/" replace />
        } 
      />
      <Route 
        path="/user" 
        element={
          user && user.role !== 'Admin' ? 
            <UserDashboard user={user} token={user.id} onLogout={onLogout} /> : 
            <Navigate to="/" replace />
        } 
      />
      <Route path="/dashboard" element={<Navigate to="/home" replace />} />
      {/* Placeholder routes for future apps */}
      <Route 
        path="/tv-setups" 
        element={
          user ? 
            <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4 dark:text-white">TV Setups</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Coming Soon</p>
                <a href="/home" className="text-blue-500 hover:underline">← Back to Home</a>
              </div>
            </div> : 
            <Navigate to="/" replace />
        } 
      />
      <Route 
        path="/find-devices" 
        element={
          user ? 
            <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
              <div className="text-center">
                <h1 className="text-2xl font-bold mb-4 dark:text-white">Find Hello Devices</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Coming Soon</p>
                <a href="/home" className="text-blue-500 hover:underline">← Back to Home</a>
              </div>
            </div> : 
            <Navigate to="/" replace />
        } 
      />
    </Routes>
  );
}

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for stored session
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <ThemeProvider>
      <div className="App">
        <BrowserRouter>
          <AppRouter user={user} onLogin={handleLogin} onLogout={handleLogout} />
        </BrowserRouter>
        <Toaster />
      </div>
    </ThemeProvider>
  );
}

export default App;
