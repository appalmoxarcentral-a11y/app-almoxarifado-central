import React from 'react';
import { UserManagement } from '@/components/users/UserManagement';
import { AuditVinculos } from '@/components/admin/AuditVinculos';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function UsuariosPage() {
  return (
    <div className="p-0 sm:p-6 space-y-6 max-w-full overflow-x-hidden">
      <Tabs defaultValue="equipe" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-full sm:max-w-[400px] rounded-none sm:rounded-lg h-12 sm:h-10">
          <TabsTrigger value="equipe" className="text-xs sm:text-sm font-bold">Gestão de Equipe</TabsTrigger>
          <TabsTrigger value="auditoria" className="text-xs sm:text-sm font-bold">Auditoria de Vínculos</TabsTrigger>
        </TabsList>
        <TabsContent value="equipe" className="mt-4 sm:mt-6">
          <UserManagement />
        </TabsContent>
        <TabsContent value="auditoria" className="mt-4 sm:mt-6 px-4 sm:px-0">
          <AuditVinculos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
