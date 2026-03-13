import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function Onboarding() {
  const [empresa, setEmpresa] = useState('');
  const [documento, setDocumento] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);

    try {
      // 1. Criar Tenant
      const slug = empresa.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.random().toString(36).substr(2, 5);
      
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert([{
          name: empresa,
          document: documento,
          slug: slug
        }])
        .select()
        .single();

      if (tenantError) throw tenantError;

      // 2. Atualizar Profile com tenant_id
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ tenant_id: tenant.id })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // 3. Criar Assinatura Trial (7 dias)
      // Buscar plano Básico
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('id')
        .eq('name', 'Básico')
        .single();
        
      if (!planError && plan) {
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + 7);

          const { error: subError } = await supabase
            .from('subscriptions')
            .insert({
                tenant_id: tenant.id,
                plan_id: plan.id,
                status: 'trialing',
                current_period_start: new Date().toISOString(),
                current_period_end: trialEnd.toISOString()
            });
            
            if (subError) {
                console.error("Erro ao criar trial", subError);
            }
      }

      toast({
        title: "Empresa criada!",
        description: "Bem-vindo ao Stock Guardian.",
      });

      // Forçar reload para atualizar contexto
      window.location.href = '/';
      
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Erro ao criar empresa",
        description: error.message || "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configurar Empresa</CardTitle>
          <CardDescription>
            Crie sua organização para começar a usar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTenant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="empresa">Nome da Empresa / Unidade</Label>
              <Input
                id="empresa"
                required
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                placeholder="Ex: Minha Clínica"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documento">CNPJ / Documento (Opcional)</Label>
              <Input
                id="documento"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Configurando...' : 'Começar Trial de 7 Dias'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
