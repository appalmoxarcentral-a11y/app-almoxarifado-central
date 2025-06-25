
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { PatientForm } from "./components/PatientForm";
import { ProductForm } from "./components/ProductForm";
import { ProductEntryForm } from "./components/ProductEntryForm";
import { DispensationForm } from "./components/DispensationForm";
import { HistoryView } from "./components/HistoryView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pacientes" element={<PatientForm />} />
            <Route path="/produtos" element={<ProductForm />} />
            <Route path="/entradas" element={<ProductEntryForm />} />
            <Route path="/dispensacao" element={<DispensationForm />} />
            <Route path="/historicos" element={<HistoryView />} />
            <Route path="/usuarios" element={<div className="p-8 text-center"><h2 className="text-2xl font-bold">Gestão de Usuários</h2><p className="text-gray-600 mt-2">Módulo em desenvolvimento</p></div>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
