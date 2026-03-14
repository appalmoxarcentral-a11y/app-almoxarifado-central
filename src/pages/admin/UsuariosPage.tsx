import React from 'react';
import { UserManagement } from '@/components/users/UserManagement';
import { AuditVinculos } from '@/components/admin/AuditVinculos';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function UsuariosPage() {
  return (
    <div className="p-6 space-y-6">
      <Tabs defaultValue="equipe">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="equipe">Gestão de Equipe</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoria de Vínculos</TabsTrigger>
        </TabsList>
        <TabsContent value="equipe" className="mt-6">
          <UserManagement />
        </TabsContent>
        <TabsContent value="auditoria" className="mt-6">
          <AuditVinculos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
