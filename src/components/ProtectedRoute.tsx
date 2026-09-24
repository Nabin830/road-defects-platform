import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import type { Role } from '../lib/types';

interface Props { children: React.ReactNode; allow?: Role[]; }
export function ProtectedRoute({ children, allow }: Props) {
  const { authed, role, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="p-6 text-muted">Loading…</div>;
  if (!authed) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (allow && !allow.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
