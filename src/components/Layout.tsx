
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon, Home, History, Users, Package, PackagePlus, Pill, ShoppingCart, UserCog, CreditCard, Zap, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import useEmblaCarousel from 'embla-carousel-react';
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { User } from "@/types";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout, impersonateUser, stopImpersonating, isImpersonating, originalUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';
  const isSubscriptionBlocked = user?.subscription_blocked && !isSuperAdmin;

  const [emblaRef] = useEmblaCarousel({
    dragFree: true,
    containScroll: false,
    align: 'start',
    skipSnaps: true
  });

  // Buscar usuários para o Acesso Rápido (apenas se for ADMIN ou SUPER_ADMIN)
  const { data: availableUsers } = useQuery({
    queryKey: ['available-users-impersonation', user?.tenant_id],
    queryFn: async () => {
      if (!user || (user.tipo !== 'ADMIN' && user.tipo !== 'SUPER_ADMIN') || isSubscriptionBlocked) return [];
      
      let query = supabase.from('profiles').select('*').eq('role', 'user');
      
      // Admin vê apenas usuários do seu tenant
      if (user.tipo === 'ADMIN' && user.tenant_id) {
        query = query.eq('tenant_id', user.tenant_id);
      }

      const { data, error } = await query.order('full_name');
      if (error) throw error;

      return data.map(p => ({
        id: p.id,
        nome: p.full_name || '',
        email: p.email || '',
        tipo: 'COMUM' as const,
        permissoes: p.permissions as any,
        ativo: true,
        created_at: p.created_at,
        tenant_id: p.tenant_id
      })) as User[];
    },
    enabled: !!user && (user.tipo === 'ADMIN' || user.tipo === 'SUPER_ADMIN') && !isImpersonating
  });

  const hasPermission = (permission: string | null) => {
    if (!permission) return true;
    if (!user) return false;
    // Administradores e Super Admins (ou quando em modo Impersonation) têm acesso total
    if (user.tipo === 'SUPER_ADMIN' || user.tipo === 'ADMIN' || isImpersonating) return true;
    return user.permissoes?.[permission] === true;
  };

  const allNavItems = [
    { icon: Home, label: "Início", path: "/", permission: null },
    { icon: Users, label: "Pacientes", path: "/pacientes", permission: "cadastro_pacientes" },
    { icon: Package, label: "Produtos", path: "/produtos", permission: "cadastro_produtos" },
    { icon: PackagePlus, label: "Entradas", path: "/entradas", permission: "entrada_produtos" },
    { icon: Pill, label: "Dispensação", path: "/dispensacao", permission: "dispensacao" },
    { icon: History, label: "Histórico", path: "/historicos", permission: "historicos" },
    { icon: ShoppingCart, label: "Compras", path: "/relatorio-compras", permission: "relatorio_compras" },
    { icon: UserCog, label: "Usuários", path: "/usuarios", permission: "gestao_usuarios" },
    // Apenas Admin do Tenant pode ver Assinatura (Super Admin também pode para gerenciar)
    ...((user?.tipo === 'ADMIN' || user?.tipo === 'SUPER_ADMIN') && user?.tenant_id ? [{ icon: CreditCard, label: "Assinatura", path: "/assinatura", permission: null }] : []),
    // Adicionar item de SaaS Admin apenas se for SUPER_ADMIN
    ...(user?.tipo === 'SUPER_ADMIN' ? [{ icon: UserCog, label: "SaaS Admin", path: "/admin", permission: "gestao_usuarios" }] : [])
  ];

  const visibleNavItems = allNavItems.filter(item => {
    // Primeiro, checa permissão básica
    if (!hasPermission(item.permission)) return false;
    
    // Se estiver bloqueado, apenas Dashboard e Assinatura são permitidos
    if (isSubscriptionBlocked) {
      return item.path === '/' || item.path === '/assinatura';
    }
    
    return true;
  });

  const isActive = (path: string) => location.pathname === path;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full max-w-full bg-background overflow-x-hidden relative">
        {/* Sidebar */}
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 max-w-full relative overflow-x-hidden">
          {/* Impersonation Banner */}
          {isImpersonating && (
            <div className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between text-sm animate-in fade-in slide-in-from-top-4 w-full">
              <div className="flex items-center gap-2 overflow-hidden">
                <Zap className="h-4 w-4 shrink-0 fill-white" />
                <span className="truncate">
                  Acesso Rápido: <strong>{user?.nome}</strong>
                </span>
              </div>
              <Button 
                variant="link" 
                size="sm" 
                className="text-white hover:text-blue-100 p-0 h-auto shrink-0 ml-2"
                onClick={stopImpersonating}
              >
                Encerrar
                <X className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Header */}
          <header className="bg-card border-b border-border px-4 py-3 flex justify-between items-center sticky top-0 z-40 w-full max-w-full">
            <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
              {!isMobile && <SidebarTrigger className="shrink-0" />}
              {isMobile && (
                <div className="flex items-center gap-1.5 shrink-0 overflow-hidden">
                  <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0">
                    <Pill className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-bold text-foreground truncate">SMSA</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              {/* Acesso Rápido Dropdown (apenas para Admin/SuperAdmin quando não está impersonando) */}
              {!isImpersonating && (user?.tipo === 'ADMIN' || user?.tipo === 'SUPER_ADMIN') && availableUsers && availableUsers.length > 0 && (
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Acesso Rápido:</span>
                  <div className="w-64">
                    <SearchableSelect
                      items={availableUsers}
                      onSelect={(u) => impersonateUser(u)}
                      getItemValue={(u) => u.id}
                      getItemLabel={(u) => u.nome}
                      getItemSearchText={(u) => `${u.nome} ${u.email}`}
                      placeholder="Selecionar usuário..."
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 md:gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium hidden sm:inline text-foreground truncate max-w-[100px]">{user?.nome}</span>
                <Badge 
                  variant={user?.tipo === 'SUPER_ADMIN' ? 'destructive' : user?.tipo === 'ADMIN' ? 'default' : 'secondary'} 
                  className="text-[9px] md:text-[10px] shrink-0"
                >
                  {user?.tipo === 'SUPER_ADMIN' ? 'SUPER' : user?.tipo === 'ADMIN' ? 'ADMIN' : 'COMUM'}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={logout} className="shrink-0">
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Sair</span>
              </Button>
            </div>
          </header>
          
          {/* Main content - add bottom padding on mobile for nav */}
          <main className={`flex-1 w-full max-w-full overflow-x-hidden p-4 lg:p-6 ${isMobile ? 'pb-24' : ''}`}>
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          {isMobile && (
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom shadow-[0_-4px_12px_rgba(0,0,0,0.05)] w-full max-w-full">
              <div className="overflow-hidden cursor-grab active:cursor-grabbing w-full" ref={emblaRef}>
                <div className="flex touch-pan-x select-none embla__container">
                  {visibleNavItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className={`flex flex-col items-center justify-center gap-1 py-3 px-1 min-w-[72px] flex-shrink-0 transition-all duration-200 relative group ${
                        isActive(item.path)
                          ? 'text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                        isActive(item.path) 
                          ? 'bg-primary/10 shadow-sm' 
                          : 'group-active:scale-90 group-active:bg-muted'
                      }`}>
                        <item.icon className={`h-5 w-5 transition-transform duration-300 ${
                          isActive(item.path) ? 'stroke-[2.5] scale-110' : ''
                        }`} />
                      </div>
                      <span className={`text-[9px] font-bold tracking-tight transition-all duration-300 ${
                        isActive(item.path) ? 'opacity-100' : 'opacity-80'
                      }`}>
                        {item.label}
                      </span>
                      
                      {isActive(item.path) && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </nav>
          )}
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
