import { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
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
            (user.role === 'Admin' ? 
              <Navigate to="/admin" replace /> : 
              <Navigate to="/user" replace />
            ) : 
            <LoginPage onLogin={onLogin} />
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
      <Route path="/dashboard" element={<Navigate to={user?.role === 'Admin' ? '/admin' : '/user'} replace />} />
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
