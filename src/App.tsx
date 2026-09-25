import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './store/auth';
import { Navbar, TabBar, Footer } from './components/Layout';
import { ToastHost } from './components/Toast';
import { ModalHost } from './components/Modal';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HomePage } from './pages/Home';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { DashboardPage } from './pages/Dashboard';
import { ReportPage } from './pages/Report';
import { DefectsPage } from './pages/Defects';
import { DefectDetailPage } from './pages/DefectDetail';
import { MyReportsPage } from './pages/MyReports';
import { ContractorPage } from './pages/Contractor';
import { AdminPage } from './pages/Admin';
import { ProfilePage } from './pages/Profile';
import { PeoplePage } from './pages/People';
import { ReportsPage } from './pages/Reports';
import { PrivacyPage, TermsPage } from './pages/Legal';

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
  const bareLayout = loc.pathname === '/login' || loc.pathname === '/register';

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col">
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
              <h1>404</h1>
              <p className="text-muted mt-2">That page doesn't exist.</p>
            </main>
          } />
        </Routes>
      </div>
      {!bareLayout && <Footer />}
      <TabBar />
      <ToastHost />
      <ModalHost />
    </div>
  );
}
