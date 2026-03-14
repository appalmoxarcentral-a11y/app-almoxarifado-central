
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LoginForm } from '@/components/auth/LoginForm';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Lazy loading components for optimized performance
const Index = lazy(() => import('@/pages/Index'));
const SignUp = lazy(() => import('@/pages/auth/SignUp').then(m => ({ default: m.SignUp })));
const Onboarding = lazy(() => import('@/pages/auth/Onboarding').then(m => ({ default: m.Onboarding })));
const SelectUnidade = lazy(() => import('@/pages/auth/SelectUnidade').then(m => ({ default: m.SelectUnidade })));
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard').then(m => ({ default: m.AdminDashboard })));
const UnidadesPage = lazy(() => import('@/pages/admin/UnidadesPage').then(m => ({ default: m.UnidadesPage })));
const UsuariosPage = lazy(() => import('@/pages/admin/UsuariosPage').then(m => ({ default: m.UsuariosPage })));
const SubscriptionPage = lazy(() => import('@/pages/subscription/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })));
const NotFound = lazy(() => import('@/pages/NotFound'));
const PatientForm = lazy(() => import('@/components/PatientForm').then(m => ({ default: m.PatientForm })));
const ProductForm = lazy(() => import('@/components/ProductForm').then(m => ({ default: m.ProductForm })));
const ProductEntryForm = lazy(() => import('@/components/ProductEntryForm').then(m => ({ default: m.ProductEntryForm })));
const DispensationForm = lazy(() => import('@/components/DispensationForm').then(m => ({ default: m.DispensationForm })));
const HistoryView = lazy(() => import('@/components/HistoryView').then(m => ({ default: m.HistoryView })));
const UserManagement = lazy(() => import('@/components/users/UserManagement').then(m => ({ default: m.UserManagement })));
const PurchaseReport = lazy(() => import('@/components/purchase-report/PurchaseReport').then(m => ({ default: m.PurchaseReport })));

const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/login" element={<LoginForm />} />
                <Route path="/signup" element={<SignUp />} />
                <Route
                  path="/select-unidade"
                  element={
                    <ProtectedRoute>
                      <SelectUnidade />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute>
                      <Onboarding />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute requiredPermission="gestao_usuarios">
                      <Layout>
                        <AdminDashboard />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/unidades"
                  element={
                    <ProtectedRoute requiredPermission="gestao_usuarios">
                      <Layout>
                        <UnidadesPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/usuarios"
                  element={
                    <ProtectedRoute requiredPermission="gestao_usuarios">
                      <Layout>
                        <UsuariosPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/" element={<Index />} />
                          <Route path="/pacientes" element={<PatientForm />} />
                          <Route path="/produtos" element={<ProductForm />} />
                          <Route path="/entradas" element={<ProductEntryForm />} />
                          <Route path="/dispensacao" element={<DispensationForm />} />
                          <Route path="/historicos" element={<HistoryView />} />
                          <Route 
                            path="/usuarios" 
                            element={
                              <ProtectedRoute requiredPermission="gestao_usuarios">
                                <UserManagement />
                              </ProtectedRoute>
                            } 
                          />
                          <Route path="/relatorio-compras" element={<PurchaseReport />} />
                          <Route path="/assinatura" element={<SubscriptionPage />} />
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
