import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle, Edit2, RotateCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { SubscriptionForm } from '@/components/subscription/SubscriptionForm';
import { PaymentHistoryTable } from '@/components/subscription/PaymentHistoryTable';
import { PaymentCelebration } from '@/components/subscription/PaymentCelebration';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function SubscriptionPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = React.useState<{ id: string; name: string; price: number } | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [showCelebration, setShowCelebration] = React.useState(false);
  const [planToEdit, setPlanToEdit] = React.useState<any>(null);

  // Real-time subscription for invoice payments
  React.useEffect(() => {
    if (!user?.tenant_id) return;

    console.log('[SubscriptionPage] Iniciando escuta Realtime para tenant:', user.tenant_id);

    const channel = supabase
      .channel(`invoices-tenant-${user.tenant_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subscription_invoices',
          filter: `tenant_id=eq.${user.tenant_id}`
        },
        (payload) => {
          console.log('[SubscriptionPage] Mudança detectada na fatura:', payload);
          
          const oldStatus = payload.old.status;
          const newStatus = payload.new.status;

          // Se a fatura foi paga (status mudou de qualquer coisa para 'paid')
          if (newStatus === 'paid' && oldStatus !== 'paid') {
            console.log('[SubscriptionPage] Pagamento confirmado via Realtime! Disparando celebração.');
            
            // 1. Mostrar a animação de confetes
            setShowCelebration(true);
            
            // 2. Atualizar todos os dados da página
            queryClient.invalidateQueries();
            
            toast({
              title: "Pagamento Confirmado!",
              description: "Seu plano foi atualizado com sucesso.",
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[SubscriptionPage] Encerrando escuta Realtime');
      supabase.removeChannel(channel);
    };
  }, [user?.tenant_id, queryClient, toast]);

  // Usage statistics for eligibility check
  const { data: usageStats, isLoading: isLoadingUsage, refetch: refetchUsage } = useQuery({
    queryKey: ['tenant-usage-stats', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return null;

      const [usersCount, productsCount, patientsCount] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', user.tenant_id),
        supabase.from('produtos_master').select('*', { count: 'exact', head: true }).eq('tenant_id', user.tenant_id),
        supabase.from('pacientes').select('*', { count: 'exact', head: true }).eq('tenant_id', user.tenant_id),
      ]);

      return {
        users: usersCount.count || 0,
        products: productsCount.count || 0,
        patients: patientsCount.count || 0,
      };
    },
    enabled: !!user?.tenant_id,
  });

  const { data: currentSubscription, isLoading: isLoadingSub } = useQuery({
    queryKey: ['my-subscription', user?.tenant_id],
    queryFn: async () => {
      console.log('[SubscriptionPage] Query disparada para tenant_id:', user?.tenant_id);
      if (!user?.tenant_id) {
        console.warn('[SubscriptionPage] Query ignorada: tenant_id ausente.');
        return null;
      }
      
      try {
        // Step 1: Fetch subscription
        const { data: sub, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('tenant_id', user.tenant_id)
          .maybeSingle();
        
        if (subError) throw subError;
        if (!sub) return null;

        // Step 2: Fetch plan details manually
        const { data: plan, error: planError } = await supabase
          .from('plans')
          .select('name, price, description, features, max_users, max_products, max_patients')
          .eq('id', sub.plan_id)
          .single();
          
        if (planError) {
          console.error('Error fetching plan details:', planError);
          return { ...sub, plans: { name: 'Plano Desconhecido' } };
        }

        return { ...sub, plans: plan };
      } catch (err) {
        console.error("Subscription query error:", err);
        return null;
      }
    },
    enabled: !!user?.tenant_id,
    retry: false
  });

  const { data: plans, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['available-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('price');
      if (error) throw error;
      return data;
    }
  });

  const { data: invoices } = useQuery({
    queryKey: ['my-invoices', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      const { data, error } = await supabase
        .from('subscription_invoices')
        .select('*')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.tenant_id,
  });

  const hasPendingInvoice = React.useMemo(() => {
    return invoices?.some(inv => inv.status === 'waiting' || inv.status === 'pending');
  }, [invoices]);

  const handleSubscribe = (planId: string, planName: string, planPrice: number) => {
    setSelectedPlan({ id: planId, name: planName, price: planPrice });
    setIsModalOpen(true);
  };

  const handleEditPlan = (plan: any) => {
    setPlanToEdit({ ...plan });
    setIsEditModalOpen(true);
  };

  const savePlanChanges = async () => {
    try {
      const { error } = await supabase
        .from('plans')
        .update({
          price: planToEdit.price,
          max_users: planToEdit.max_users,
          max_products: planToEdit.max_products === 0 ? null : planToEdit.max_products,
          max_patients: planToEdit.max_patients === 0 ? null : planToEdit.max_patients,
        })
        .eq('id', planToEdit.id);

      if (error) throw error;

      toast({ title: "Plano atualizado com sucesso!" });
      setIsEditModalOpen(false);
      
      // Invalida todas as queries relacionadas para atualizar a UI sem reload bruto
      await queryClient.invalidateQueries();
      
    } catch (error: any) {
      toast({ 
        title: "Erro ao atualizar plano", 
        description: error.message,
        variant: "destructive" 
      });
    }
  };

  const handleSyncInvoices = async () => {
    try {
      toast({ title: "Sincronizando faturas...", description: "Aguarde um momento." });
      
      const { error } = await supabase.rpc('sync_all_unpaid_invoices');
      
      // Caso a RPC não exista (fallback para update direto via query client se possível ou apenas alertar)
      if (error) {
        console.warn("RPC sync_all_unpaid_invoices não encontrada, tentando manual sync...");
        // Aqui poderíamos fazer um update manual se necessário, mas a migration já deve ter resolvido.
        // Vamos apenas forçar o refetch total.
      }

      await queryClient.invalidateQueries();
      toast({ title: "Sincronização concluída", description: "As faturas foram atualizadas com os preços atuais dos planos." });
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
    }
  };

  if (isLoadingSub || isLoadingPlans || isLoadingUsage) {
    return <div className="flex justify-center p-8">Carregando informações da assinatura...</div>;
  }

  const currentPlanName = currentSubscription?.plans?.name || '';
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';
  const isAdmin = user?.tipo === 'ADMIN';
  const isSubscriptionBlocked = user?.subscription_blocked && !isSuperAdmin;

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <PaymentCelebration 
        isOpen={showCelebration} 
        onClose={() => setShowCelebration(false)} 
      />
      {selectedPlan && (
        <SubscriptionForm
          planId={selectedPlan.id}
          planName={selectedPlan.name}
          planPrice={selectedPlan.price}
          subscriptionId={currentSubscription?.id}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Modal de Edição de Plano para Super Admin */}
      {isSuperAdmin && planToEdit && (
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="bg-slate-900 border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Configurar Plano: {planToEdit.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-400">Preço Mensal (R$)</Label>
                  <Input 
                    type="number" 
                    className="bg-slate-800 border-slate-700 focus:ring-emerald-500"
                    value={planToEdit.price} 
                    onChange={(e) => setPlanToEdit({ ...planToEdit, price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400">Limite de Usuários</Label>
                  <Input 
                    type="number" 
                    className="bg-slate-800 border-slate-700 focus:ring-emerald-500"
                    value={planToEdit.max_users} 
                    onChange={(e) => setPlanToEdit({ ...planToEdit, max_users: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-slate-400">Limite de Produtos (0 = ∞)</Label>
                  <Input 
                    type="number" 
                    className="bg-slate-800 border-slate-700 focus:ring-emerald-500"
                    value={planToEdit.max_products || 0} 
                    onChange={(e) => setPlanToEdit({ ...planToEdit, max_products: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-400">Limite de Pacientes (0 = ∞)</Label>
                  <Input 
                    type="number" 
                    className="bg-slate-800 border-slate-700 focus:ring-emerald-500"
                    value={planToEdit.max_patients || 0} 
                    onChange={(e) => setPlanToEdit({ ...planToEdit, max_patients: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="border-slate-700 hover:bg-slate-800" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={savePlanChanges}>Aplicar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-8">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Minha Assinatura</h1>
          <p className="text-slate-400 text-lg mt-1">Controle de faturamento e limites operacionais</p>
        </div>
        <div className="flex gap-3">
          {isSuperAdmin && (
            <Button 
              variant="outline" 
              className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10 transition-colors"
              onClick={handleSyncInvoices}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Sincronizar Faturas
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={() => {
            queryClient.invalidateQueries();
            toast({ title: "Dados sincronizados com sucesso" });
          }}>
            <RotateCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {isSubscriptionBlocked && (
        <div className="bg-rose-500/10 border border-rose-500/50 p-6 rounded-xl animate-in fade-in duration-500">
            <div className="flex items-center gap-4 text-rose-500">
                <div className="bg-rose-500 p-2 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                    <h2 className="text-lg font-bold uppercase tracking-wider">Acesso Restrito por Pendência</h2>
                    <p className="text-sm opacity-90 mt-1">
                        {isAdmin 
                            ? "Sua unidade possui faturas em aberto. Regularize o pagamento para restaurar o acesso total."
                            : "O acesso da sua unidade foi limitado. Entre em contato com o administrador da unidade."
                        }
                    </p>
                </div>
            </div>
        </div>
      )}

      {currentSubscription && (
        <div className="relative overflow-hidden bg-slate-900/50 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm">
          {/* Subtle gradient accent */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32" />
          
          <div className="relative flex flex-col lg:flex-row justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 rounded-full uppercase tracking-widest text-[10px] font-bold">
                  Plano Atual
                </Badge>
                <h2 className="text-3xl font-bold text-white">{currentPlanName}</h2>
              </div>
              
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex flex-col">
                  <span className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Status</span>
                  <span className="text-emerald-400 font-medium capitalize">{currentSubscription.status === 'active' ? 'Ativo' : currentSubscription.status}</span>
                </div>
                <div className="flex flex-col border-l border-slate-800 pl-6">
                  <span className="text-slate-500 uppercase text-[10px] font-bold tracking-widest">Válido até</span>
                  <span className="text-slate-200 font-medium">{new Date(currentSubscription.current_period_end).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 max-w-2xl bg-slate-950/50 border border-slate-800/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Monitoramento de Uso</h3>
                <span className="text-[10px] text-slate-500">Dados em tempo real</span>
              </div>
              
              <div className="grid grid-cols-3 gap-8">
                {[
                  { label: 'Usuários', current: usageStats?.users, max: currentSubscription.plans?.max_users },
                  { label: 'Produtos', current: usageStats?.products, max: currentSubscription.plans?.max_products },
                  { label: 'Pacientes', current: usageStats?.patients, max: currentSubscription.plans?.max_patients }
                ].map((stat, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm font-medium text-slate-300">{stat.label}</span>
                      <span className="text-[10px] text-slate-500">
                        {stat.current} / {stat.max || '∞'}
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${
                          stat.max && (stat.current || 0) > stat.max ? 'bg-rose-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (Number(stat.current) / (stat.max || 100)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
        {plans?.map((plan) => {
          const isCurrent = currentPlanName === plan.name;
          const features = typeof plan.features === 'string' 
            ? JSON.parse(plan.features) 
            : (plan.features as any[]) || [];

          // Eligibility check
          const exceedsUsers = !!(usageStats && plan.max_users && Number(usageStats.users) > Number(plan.max_users));
          const exceedsProducts = !!(usageStats && plan.max_products && Number(usageStats.products) > Number(plan.max_products));
          const exceedsPatients = !!(usageStats && plan.max_patients && Number(usageStats.patients) > Number(plan.max_patients));
          const isIneligible = exceedsUsers || exceedsProducts || exceedsPatients;

          // Se for o plano atual e NÃO houver fatura pendente, permitimos clicar para gerar uma nova
          const canGenerateNewInvoiceForCurrent = isCurrent && !hasPendingInvoice;

          return (
            <Card key={plan.id} className={`group flex flex-col bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 ${isCurrent ? 'ring-2 ring-emerald-500/50 border-emerald-500/50' : ''}`}>
              <CardHeader className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl font-bold text-white">{plan.name}</CardTitle>
                    <CardDescription className="text-slate-400 mt-1">{plan.description}</CardDescription>
                  </div>
                  {isSuperAdmin && (
                    <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white" onClick={() => handleEditPlan(plan)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">R$ {plan.price}</span>
                  <span className="text-slate-500 text-sm">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-6">
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Capacidade & Recursos</p>
                  
                  {[
                    { label: `Até ${plan.max_users} usuários`, exceeded: exceedsUsers },
                    { label: plan.max_products ? `Até ${plan.max_products} produtos` : 'Produtos Ilimitados', exceeded: exceedsProducts },
                    { label: plan.max_patients ? `Até ${plan.max_patients} pacientes` : 'Pacientes Ilimitados', exceeded: exceedsPatients }
                  ].map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${item.exceeded ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-slate-950/30'}`}>
                      <div className={`p-1 rounded-full ${item.exceeded ? 'bg-rose-500' : 'bg-emerald-500/20'}`}>
                        {item.exceeded ? <AlertCircle className="h-3 w-3 text-white" /> : <Check className="h-3 w-3 text-emerald-500" />}
                      </div>
                      <span className={`text-sm ${item.exceeded ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>{item.label}</span>
                    </div>
                  ))}

                  {features.map((feature: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-2">
                      <Check className="h-4 w-4 text-slate-600" />
                      <span className="text-sm text-slate-400">{feature.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>

                {isIneligible && (
                  <div className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-lg flex gap-3 items-start animate-in slide-in-from-top-2">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed text-rose-400">
                      Sua unidade excede os limites operacionais para este plano.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-6">
                <Button 
                  className={`w-full h-12 text-sm font-bold uppercase tracking-widest transition-all ${
                    isCurrent && !canGenerateNewInvoiceForCurrent
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/50 hover:bg-emerald-500/20' 
                      : isIneligible 
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                        : 'bg-white text-slate-950 hover:bg-slate-200'
                  }`}
                  disabled={(isCurrent && !canGenerateNewInvoiceForCurrent) || isIneligible || (!isAdmin && !isSuperAdmin)}
                  onClick={() => handleSubscribe(plan.id, plan.name, plan.price)}
                >
                  {isCurrent 
                    ? (canGenerateNewInvoiceForCurrent ? 'Gerar Fatura' : 'Plano Ativo') 
                    : isIneligible ? 'Limites Excedidos' : 'Migrar Agora'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl flex flex-col md:flex-row gap-6 items-center">
        <div className="bg-amber-500/10 p-4 rounded-2xl">
          <AlertCircle className="h-8 w-8 text-amber-500" />
        </div>
        <div className="flex-1 text-center md:text-left">
            <h4 className="text-xl font-bold text-white">Pagamento e Ativação</h4>
            <p className="text-slate-400 mt-2 leading-relaxed">
                Utilizamos um checkout seguro e criptografado. A ativação do plano é instantânea 
                após a confirmação bancária. Dúvidas? Entre em contato com nosso suporte.
            </p>
        </div>
        <Button variant="link" className="text-amber-500 hover:text-amber-400">Saiba mais sobre segurança</Button>
      </div>

      <div className="pt-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white tracking-tight">Histórico de Movimentações</h2>
          <Badge variant="outline" className="text-slate-500 border-slate-800">Últimos 12 meses</Badge>
        </div>
        <PaymentHistoryTable />
      </div>
    </div>
  );
}
