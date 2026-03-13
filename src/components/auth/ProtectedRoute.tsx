import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { user, isLoading, hasPermission } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Permitir acesso ao admin para usuários ADMIN mesmo sem tenant_id (Super Admin Global)
  const isSuperAdmin = user.tipo === 'SUPER_ADMIN';
  const isAdmin = user.tipo === 'ADMIN';

  // Se o usuário já tem tenant_id e tenta acessar onboarding, manda para home
  if (user.tenant_id && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  // Lógica de Bloqueio de Assinatura
  // Se estiver bloqueado, só pode acessar a página de assinatura e o Dashboard
  if (user.subscription_blocked && !isSuperAdmin) {
    const allowedPaths = ['/assinatura', '/'];
    if (!allowedPaths.includes(location.pathname)) {
      return <Navigate to="/assinatura" replace />;
    }
  }

  // Restrição da rota /admin apenas para SUPER_ADMIN
  if (location.pathname.startsWith('/admin') && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Restrito</h2>
          <p className="text-gray-600">Apenas o proprietário do sistema tem acesso a esta área.</p>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission as any)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
