
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { PatientForm } from "./components/PatientForm";
import { ProductForm } from "./components/ProductForm";
import { ProductEntryForm } from "./components/ProductEntryForm";
import { DispensationForm } from "./components/DispensationForm";
import { HistoryView } from "./components/HistoryView";
import { UserManagement } from "./components/users/UserManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route 
                  path="/pacientes" 
                  element={
                    <ProtectedRoute requiredPermission="cadastro_pacientes">
                      <PatientForm />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/produtos" 
                  element={
                    <ProtectedRoute requiredPermission="cadastro_produtos">
                      <ProductForm />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/entradas" 
                  element={
                    <ProtectedRoute requiredPermission="entrada_produtos">
                      <ProductEntryForm />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/dispensacao" 
                  element={
                    <ProtectedRoute requiredPermission="dispensacao">
                      <DispensationForm />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/historicos" 
                  element={
                    <ProtectedRoute requiredPermission="historicos">
                      <HistoryView />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/usuarios" 
                  element={
                    <ProtectedRoute requiredPermission="gestao_usuarios">
                      <UserManagement />
                    </ProtectedRoute>
                  } 
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
