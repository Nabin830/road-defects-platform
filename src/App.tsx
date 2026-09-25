import { useEffect, lazy, Suspense, type ComponentType } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './store/auth';
import { Navbar, TabBar, Footer } from './components/Layout';
import { ToastHost } from './components/Toast';
import { ModalHost } from './components/Modal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/Home';

// Each page's code loads only when someone opens it (council and contractor pages aren't sent to residents)
const page = <K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) =>
  lazy(() => load().then(m => ({ default: m[name] })));
const LoginPage = page(() => import('./pages/Login'), 'LoginPage');
const RegisterPage = page(() => import('./pages/Register'), 'RegisterPage');
const DashboardPage = page(() => import('./pages/Dashboard'), 'DashboardPage');
const ReportPage = page(() => import('./pages/Report'), 'ReportPage');
const DefectsPage = page(() => import('./pages/Defects'), 'DefectsPage');
const DefectDetailPage = page(() => import('./pages/DefectDetail'), 'DefectDetailPage');
const MyReportsPage = page(() => import('./pages/MyReports'), 'MyReportsPage');
const ContractorPage = page(() => import('./pages/Contractor'), 'ContractorPage');
const AdminPage = page(() => import('./pages/Admin'), 'AdminPage');
const ProfilePage = page(() => import('./pages/Profile'), 'ProfilePage');
const PeoplePage = page(() => import('./pages/People'), 'PeoplePage');
const ReportsPage = page(() => import('./pages/Reports'), 'ReportsPage');
const PrivacyPage = page(() => import('./pages/Legal'), 'PrivacyPage');
const TermsPage = page(() => import('./pages/Legal'), 'TermsPage');

export function App() {
  const loc = useLocation();
  const refreshProfile = useAuth(s => s.refreshProfile);
  // Pick up role changes made by council (e.g. promoted to admin) without signing out and in again
  useEffect(() => {
    const onFocus = () => { refreshProfile(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshProfile]);
  useEffect(() => { refreshProfile(); }, [loc.pathname, refreshProfile]);
  // New page → start at the top (a SPA keeps the old scroll position otherwise)
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const bareLayout = loc.pathname === '/login' || loc.pathname === '/register';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col">
        <ErrorBoundary resetKey={loc.pathname}>
          <Suspense fallback={<div className="w-full max-w-[1280px] mx-auto px-6 py-16 text-center text-muted">Loading…</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/defects" element={<DefectsPage />} />
            <Route path="/defect/:id" element={<DefectDetailPage />} />
            <Route path="/report" element={<ProtectedRoute allow={['citizen']}><ReportPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute allow={['citizen']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/my-reports" element={<ProtectedRoute allow={['citizen']}><MyReportsPage /></ProtectedRoute>} />
            <Route path="/contractor" element={<ProtectedRoute allow={['contractor']}><ContractorPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/admin/people" element={<ProtectedRoute allow={['admin']}><PeoplePage /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute allow={['admin']}><ReportsPage /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute allow={['admin']}><AdminPage /></ProtectedRoute>} />
            <Route path="*" element={
              <main className="w-full max-w-[600px] mx-auto px-6 py-20 text-center">
                <h1>Page not found</h1>
                <p className="text-muted mt-2 mb-6">That page doesn't exist. It may have moved, or the link was mistyped.</p>
                <a href="#/" className="btn btn-primary hover:no-underline">Go to the home page</a>
              </main>
            } />
          </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>
      {!bareLayout && <Footer />}
      <TabBar />
      <ToastHost />
      <ModalHost />
    </div>
  );
}
