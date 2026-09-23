import { Routes, Route, useLocation } from 'react-router-dom';
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

export function App() {
  const loc = useLocation();
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
          <Route path="/report" element={<ReportPage />} />
          <Route path="/dashboard" element={<ProtectedRoute allow={['citizen']}><DashboardPage /></ProtectedRoute>} />
          <Route path="/my-reports" element={<ProtectedRoute allow={['citizen']}><MyReportsPage /></ProtectedRoute>} />
          <Route path="/contractor" element={<ProtectedRoute allow={['contractor']}><ContractorPage /></ProtectedRoute>} />
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
