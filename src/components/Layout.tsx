
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { LogOut, User, Home, History, Users, Package, PackagePlus, Pill, ShoppingCart, UserCog } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const hasPermission = (permission: string | null) => {
    if (!permission) return true;
    if (!user) return false;
    if (user.tipo === 'ADMIN') return true;
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
  ];

  const visibleNavItems = allNavItems.filter(item => hasPermission(item.permission));

  const isActive = (path: string) => location.pathname === path;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background">
        {/* Desktop sidebar */}
        {!isMobile && <AppSidebar />}
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-card border-b border-border px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              {!isMobile && <SidebarTrigger />}
              {isMobile && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                    <Pill className="w-3.5 h-3.5 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">UBSF</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium hidden sm:inline text-foreground">{user?.nome}</span>
                <Badge variant={user?.tipo === 'ADMIN' ? 'default' : 'secondary'} className="text-[10px]">
                  {user?.tipo}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={logout}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </header>
          
          {/* Main content - add bottom padding on mobile for nav */}
          <main className={`flex-1 p-4 lg:p-6 ${isMobile ? 'pb-24' : ''}`}>
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          {isMobile && (
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
              <div className="flex items-center overflow-x-auto no-scrollbar">
                {visibleNavItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex flex-col items-center gap-0.5 py-2 px-2.5 min-w-[60px] flex-shrink-0 transition-colors ${
                      isActive(item.path)
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <item.icon className={`h-5 w-5 ${isActive(item.path) ? 'stroke-[2.5]' : ''}`} />
                    <span className="text-[9px] font-medium leading-tight">{item.label}</span>
                  </button>
                ))}
              </div>
            </nav>
          )}
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
