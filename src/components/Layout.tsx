
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Toaster } from "@/components/ui/toaster";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-slate-50">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          {/* Header com trigger do menu e informações do usuário */}
          <header className="bg-white border-b px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="lg:hidden" />
              <SidebarTrigger className="hidden lg:block" />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium hidden sm:inline">{user?.nome}</span>
                <Badge variant={user?.tipo === 'ADMIN' ? 'default' : 'secondary'}>
                  {user?.tipo}
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={() => logout()}>
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </header>
          
          <main className="flex-1 p-4 lg:p-6">
            {children}
          </main>
        </div>
        <Toaster />
      </div>
    </SidebarProvider>
  );
}
