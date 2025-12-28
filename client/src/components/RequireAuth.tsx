import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return null;
  }
  if (!user || (user.role !== 'admin' && user.role !== 'viewer')) {
    return <Navigate to="/contests" replace />;
  }
  return children;
}
