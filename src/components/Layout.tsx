
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { LogOut, User as UserIcon, Home, History, Users, Package, PackagePlus, Pill, ShoppingCart, UserCog, CreditCard, Building2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import useEmblaCarousel from 'embla-carousel-react';
import type { User } from "@/types";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';
  const isSubscriptionBlocked = user?.subscription_blocked && !isSuperAdmin;
  const firstName = user?.nome?.split(' ')[0] || '';

  const [emblaRef] = useEmblaCarousel({
    dragFree: true,
    containScroll: false,
    align: 'start',
    skipSnaps: true
  });

  const hasPermission = (permission: string | null) => {
    if (!permission) return true;
    if (!user) return false;
    // Administradores e Super Admins têm acesso total
    if (user.tipo === 'SUPER_ADMIN' || user.tipo === 'ADMIN') return true;
    return user.permissoes?.[permission] === true;
  };

  const allNavItems = [
    { icon: Home, label: "Início", path: "/", permission: null },
    { icon: Users, label: "Pacientes", path: "/pacientes", permission: "cadastro_pacientes" },
    { icon: Package, label: "Produtos", path: "/produtos", permission: "cadastro_produtos" },
    { icon: PackagePlus, label: "Entradas", path: "/entradas", permission: "entrada_produtos" },
    { icon: Pill, label: "Dispensação", path: "/dispensacao", permission: "dispensacao" },
    { icon: History, label: "Históricos", path: "/historicos", permission: "historicos" },
    { icon: ShoppingCart, label: "Pedidos", path: "/relatorio-compras", permission: "relatorio_compras" },
    // Seção de Administração (Para Admin e Super Admin)
    ...((user?.tipo === 'ADMIN' || user?.tipo === 'SUPER_ADMIN') ? [
      { icon: Users, label: "Membros", path: "/usuarios", permission: "gestao_usuarios" },
      { icon: UserCog, label: "Gestão Equipe", path: "/admin/usuarios", permission: "gestao_usuarios" },
      { icon: Building2, label: "Gestão Unidades", path: "/admin/unidades", permission: "gestao_usuarios" },
    ] : []),
    // Apenas Admin do Tenant pode ver Assinatura (Super Admin também pode para gerenciar)
    ...((user?.tipo === 'ADMIN' || user?.tipo === 'SUPER_ADMIN') && user?.tenant_id ? [{ icon: CreditCard, label: "Assinatura", path: "/assinatura", permission: null }] : []),
    // Item de SaaS Admin para acesso rápido ao dashboard global (Apenas Super Admin)
    ...(user?.tipo === 'SUPER_ADMIN' ? [{ icon: UserCog, label: "Painel SaaS", path: "/admin", permission: "gestao_usuarios" }] : [])
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
      <div className="min-h-screen flex w-full max-w-full bg-background relative">
        {/* Sidebar */}
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0 max-w-full relative">
          {/* Header */}
          <header className="bg-card border-b border-border px-4 py-3 flex justify-between items-center sticky top-0 z-40 w-full max-w-full">
            <div className="flex items-center gap-2 md:gap-3 overflow-hidden">
              {!isMobile && <SidebarTrigger className="shrink-0" />}
              {isMobile && (
                <div className="flex items-center gap-1.5 shrink-0 overflow-hidden max-w-[150px]">
                  <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <span className="text-xs font-black text-foreground uppercase truncate tracking-tight">
                    {user?.unidade_nome || 'SMSA'}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-6 shrink-0">
              {/* Unidade em Destaque */}
              {user?.unidade_nome && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <Building2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide truncate max-w-[200px]">
                    {user.unidade_nome}
                  </span>
                </div>
              )}
              
              <div className="flex items-center gap-1.5 md:gap-2">
                <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-bold text-foreground truncate max-w-[80px] md:max-w-[150px]">
                  {isMobile ? firstName : user?.nome}
                </span>
                <Badge 
                  variant={user?.tipo === 'SUPER_ADMIN' ? 'destructive' : user?.tipo === 'ADMIN' ? 'default' : 'secondary'} 
                  className="text-[9px] md:text-[10px] shrink-0 font-black uppercase"
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
          <main className={`flex-1 w-full max-w-full p-4 lg:p-6 ${isMobile ? 'pb-24' : ''}`}>
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
