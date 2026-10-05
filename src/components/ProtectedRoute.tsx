import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import type { Role } from '../lib/types';

export const homeFor = (role: Role) => role === 'admin' ? '/admin' : role === 'contractor' ? '/contractor' : '/dashboard';

interface Props { children: React.ReactNode; allow?: Role[]; }
export function ProtectedRoute({ children, allow }: Props) {
  const { authed, role, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="min-h-[85vh] p-6 text-muted">Loading…</div>;
  if (!authed) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  // Signed in but the wrong role for this page → their own home, not a dead end
  if (allow && !allow.includes(role)) return <Navigate to={homeFor(role)} replace />;
  return <>{children}</>;
}
