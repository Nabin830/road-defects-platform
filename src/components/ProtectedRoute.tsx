import { Navigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import type { Role } from '../lib/types';

interface Props { children: React.ReactNode; allow?: Role[]; }
export function ProtectedRoute({ children, allow }: Props) {
  const { authed, role, ready } = useAuth();
  if (!ready) return <div className="p-6 text-muted">Loading…</div>;
  if (!authed) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
