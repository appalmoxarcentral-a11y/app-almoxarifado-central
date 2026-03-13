
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/toaster';
import { Layout } from '@/components/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { LoginForm } from '@/components/auth/LoginForm';
import { SignUp } from '@/pages/auth/SignUp';
import { Onboarding } from '@/pages/auth/Onboarding';
import { AdminDashboard } from '@/pages/admin/Dashboard';
import { SubscriptionPage } from '@/pages/subscription/SubscriptionPage';
import Index from '@/pages/Index';
import NotFound from '@/pages/NotFound';
import { PatientForm } from '@/components/PatientForm';
import { ProductForm } from '@/components/ProductForm';
import { ProductEntryForm } from '@/components/ProductEntryForm';
import { DispensationForm } from '@/components/DispensationForm';
import { HistoryView } from '@/components/HistoryView';
import { UserManagement } from '@/components/users/UserManagement';
import { PurchaseReport } from '@/components/purchase-report/PurchaseReport';

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
          <Routes>
            <Route path="/login" element={<LoginForm />} />
            <Route path="/signup" element={<SignUp />} />
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
                      <Route path="/usuarios" element={<UserManagement />} />
                      <Route path="/relatorio-compras" element={<PurchaseReport />} />
                      <Route path="/assinatura" element={<SubscriptionPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
