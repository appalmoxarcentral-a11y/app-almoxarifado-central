import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

export function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
  const { user, isLoading, hasPermission, isImpersonating } = useAuth();
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
  const isSuperAdmin = user.tipo === 'SUPER_ADMIN' || isImpersonating;
  const isAdmin = user.tipo === 'ADMIN' || isSuperAdmin;

  // Se o usuário já tem tenant_id e tenta acessar onboarding, manda para home
  if (user.tenant_id && location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  // Lógica de Bloqueio de Unidade
  // Se o usuário não tiver unidade_id e não for Super Admin nem Admin acessando área administrativa, redireciona para seleção
  const isAccessingAdmin = location.pathname.startsWith('/admin');
  if (!user.unidade_id && !isSuperAdmin && (!isAdmin || !isAccessingAdmin) && location.pathname !== '/select-unidade') {
    return <Navigate to="/select-unidade" replace />;
  }

  // Se o usuário já tem unidade_id e tenta acessar seleção de unidade, manda para home
  if (user.unidade_id && location.pathname === '/select-unidade') {
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

  // Restrição da rota /admin para SUPER_ADMIN e ADMIN (conforme solicitado pelo usuário)
  // Nota: O usuário disse que Admin e Super Admin estão com acesso restrito, 
  // o que sugere que ambos deveriam ter acesso ou que a trava está pegando o Super Admin por erro.
  if (location.pathname.startsWith('/admin') && !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Acesso Restrito</h2>
          <p className="text-gray-600">Apenas administradores têm acesso a esta área.</p>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission as any)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
