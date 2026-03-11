
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { LogOut, User, Home, History, Users, Settings } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const bottomNavItems = [
    { icon: Home, label: "Início", path: "/" },
    { icon: History, label: "Histórico", path: "/historicos" },
    { icon: Users, label: "Pacientes", path: "/pacientes" },
    { icon: Settings, label: "Ajustes", path: "/produtos" },
  ];

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
                <SidebarTrigger />
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium hidden sm:inline text-foreground">{user?.nome}</span>
                <Badge variant={user?.tipo === 'ADMIN' ? 'default' : 'secondary'}>
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
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border">
              <div className="flex items-center justify-around py-2 px-2">
                {bottomNavItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors min-w-0 ${
                      isActive(item.path)
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="text-[10px] font-medium">{item.label}</span>
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
