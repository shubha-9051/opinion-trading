import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    // You could add a loading spinner here
    return <div className="auth-loading">Loading...</div>;
  }
  
  if (!currentUser) {
    // Redirect to login page, but save the attempted URL
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }
  
  return children;
}

export default ProtectedRoute;