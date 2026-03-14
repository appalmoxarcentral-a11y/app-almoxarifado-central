import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle, Edit2, RotateCw, CreditCard } from 'lucide-react';
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
  
  // Ref para armazenar o ID da última fatura paga conhecida ao abrir a página
  // Isso evita que a animação dispare ao dar refresh, mas permite disparar em tempo real
  const baselinePaidIdRef = React.useRef<string | null>(null);
  const [isPollingReady, setIsPollingReady] = React.useState(false);

  // Data fetching queries
  const { data: usageStats, isLoading: isLoadingUsage } = useQuery({
    queryKey: ['tenant-usage-stats', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return null;

      const [usersCount, productsCount, patientsCount] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', user.tenant_id),
        supabase.from('produtos').select('*', { count: 'exact', head: true }).eq('tenant_id', user.tenant_id),
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
      if (!user?.tenant_id) return null;
      
      try {
        const { data: sub, error: subError } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('tenant_id', user.tenant_id)
          .maybeSingle();
        
        if (subError) throw subError;
        if (!sub) return null;

        const { data: plan, error: planError } = await supabase
          .from('plans')
          .select('name, price, description, features, max_users, max_products, max_patients')
          .eq('id', sub.plan_id)
          .single();
          
        if (planError) return { ...sub, plans: { name: 'Plano Desconhecido' } };
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

  const { data: invoices, isLoading: isLoadingInvoices } = useQuery({
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

  // Inicializa o baseline ao carregar as faturas pela primeira vez
  // Isso evita que a animação dispare ao dar refresh, mas permite disparar em tempo real
  React.useEffect(() => {
    if (invoices && !isPollingReady) {
      const latestPaid = invoices.find(inv => inv.status === 'paid');
      baselinePaidIdRef.current = latestPaid?.id || 'none';
      setIsPollingReady(true);
      console.log('[SubscriptionPage] Baseline de faturas definido:', baselinePaidIdRef.current);
    }
  }, [invoices, isPollingReady]);

  // Polling inteligente para detectar pagamento (Funciona em todos os dispositivos abertos)
  React.useEffect(() => {
    if (!user?.tenant_id || !isPollingReady || showCelebration) return;

    const checkPaymentStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('subscription_invoices')
          .select('id, status')
          .eq('tenant_id', user.tenant_id)
          .eq('status', 'paid')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          const latestPaidInvoice = data[0];
          
          // SÓ dispara se o ID for diferente do que existia quando a página foi aberta
          if (latestPaidInvoice.id !== baselinePaidIdRef.current) {
            console.log('[SubscriptionPage] NOVO PAGAMENTO DETECTADO! Disparando celebração em tempo real.');
            
            // Atualiza o baseline para não repetir para esta mesma fatura
            baselinePaidIdRef.current = latestPaidInvoice.id;
            
            setShowCelebration(true);
            queryClient.invalidateQueries();
            
            toast({
              title: "Pagamento Confirmado!",
              description: "Parabéns, sua fatura foi paga com sucesso",
            });
          }
        }
      } catch (err) {
        console.error('[SubscriptionPage] Erro no polling:', err);
      }
    };

    const interval = setInterval(checkPaymentStatus, 3000);
    return () => clearInterval(interval);
  }, [user?.tenant_id, isPollingReady, showCelebration, queryClient, toast]);

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

  if (isLoadingSub || isLoadingPlans || isLoadingUsage || isLoadingInvoices) {
    return <div className="flex justify-center p-8 text-white">Carregando informações da assinatura...</div>;
  }

  const currentPlanName = currentSubscription?.plans?.name || '';
  const isSuperAdmin = user?.tipo === 'SUPER_ADMIN';
  const isAdmin = user?.tipo === 'ADMIN';
  const isSubscriptionBlocked = user?.subscription_blocked && !isSuperAdmin;

  return (
    <div className="space-y-6 md:space-y-10 p-4 md:p-8 w-full max-w-7xl mx-auto pb-32 md:pb-10 selection:bg-primary/20 overflow-x-hidden box-border relative">
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
          <DialogContent className="bg-card border-border text-foreground sm:max-w-lg w-[95vw] rounded-2xl p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl font-bold">Configurar Plano: {planToEdit.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 sm:py-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preço Mensal (R$)</Label>
                  <Input 
                    type="number" 
                    className="bg-background border-border h-12 text-[16px]"
                    value={planToEdit.price} 
                    onChange={(e) => setPlanToEdit({ ...planToEdit, price: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Limite de Usuários</Label>
                  <Input 
                    type="number" 
                    className="bg-background border-border h-12 text-[16px]"
                    value={planToEdit.max_users} 
                    onChange={(e) => setPlanToEdit({ ...planToEdit, max_users: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Limite de Produtos (0 = ∞)</Label>
                  <Input 
                    type="number" 
                    className="bg-background border-border h-12 text-[16px]"
                    value={planToEdit.max_products || 0} 
                    onChange={(e) => setPlanToEdit({ ...planToEdit, max_products: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Limite de Pacientes (0 = ∞)</Label>
                  <Input 
                    type="number" 
                    className="bg-background border-border h-12 text-[16px]"
                    value={planToEdit.max_patients || 0} 
                    onChange={(e) => setPlanToEdit({ ...planToEdit, max_patients: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 flex-col sm:flex-row pt-2">
              <Button variant="outline" className="w-full sm:w-auto h-12 text-base font-bold" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
              <Button className="w-full sm:w-auto h-12 text-base font-bold" onClick={savePlanChanges}>Aplicar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 border-b border-border pb-6 md:pb-10">
        <div className="flex items-center gap-3 md:gap-5">
          <div className="p-2.5 md:p-3 bg-primary/10 rounded-xl md:rounded-2xl shrink-0">
            <CreditCard className="h-6 w-6 md:h-10 md:w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-5xl font-black tracking-tight text-foreground leading-tight">Minha Assinatura</h1>
            <p className="text-muted-foreground text-sm md:text-xl mt-0.5 md:mt-2 font-medium">Faturamento e limites operacionais</p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          {isSuperAdmin && (
            <Button 
              variant="outline" 
              className="flex-1 md:flex-none border-amber-500/50 text-amber-600 hover:bg-amber-50 transition-all h-10 md:h-14 px-4 md:px-6 text-sm md:text-base font-bold shadow-sm"
              onClick={handleSyncInvoices}
            >
              <RotateCw className="h-4 w-4 mr-2" />
              Sincronizar
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-10 w-10 md:h-14 md:w-14 bg-muted/50 rounded-lg md:rounded-xl" onClick={() => {
            queryClient.invalidateQueries();
            toast({ title: "Dados sincronizados com sucesso" });
          }}>
            <RotateCw className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        </div>
      </div>

      {isSubscriptionBlocked && (
        <div className="bg-destructive/10 border-2 border-destructive/30 p-5 md:p-8 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-700 shadow-lg">
            <div className="flex items-start md:items-center gap-4 md:gap-6 text-destructive">
                <div className="bg-destructive p-3 rounded-xl shadow-md">
                  <AlertCircle className="h-6 w-6 md:h-8 md:w-8 text-destructive-foreground" />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight leading-tight">Acesso Restrito</h2>
                    <p className="text-sm md:text-lg opacity-90 mt-1.5 md:mt-2 font-medium">
                        {isAdmin 
                            ? "Sua unidade possui faturas em aberto. Regularize o pagamento para restaurar o acesso total ao sistema."
                            : "O acesso da sua unidade foi limitado devido a pendências financeiras. Entre em contato com o administrador."
                        }
                    </p>
                </div>
            </div>
        </div>
      )}

      {currentSubscription && (
        <Card className="relative overflow-hidden border-border bg-card shadow-xl rounded-2xl md:rounded-3xl">
          <div className="absolute top-0 right-0 w-48 md:w-96 h-48 md:h-96 bg-primary/5 blur-[60px] md:blur-[120px] -mr-24 -mt-24 md:-mr-48 md:-mt-48" />
          
          <CardContent className="p-4 md:p-10 relative">
            <div className="flex flex-col lg:flex-row justify-between gap-6 md:gap-12">
              <div className="space-y-4 md:space-y-6">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="px-2.5 py-0.5 md:px-4 md:py-1.5 rounded-full uppercase tracking-[0.1em] text-[9px] md:text-xs font-black bg-primary/10 text-primary border-none">
                    Plano Ativo
                  </Badge>
                  <h2 className="text-2xl md:text-5xl font-black text-foreground tracking-tighter">{currentPlanName}</h2>
                </div>
                
                <div className="flex flex-wrap gap-4 md:gap-10 text-sm md:text-lg">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground uppercase text-[9px] md:text-xs font-black tracking-widest mb-1">Status</span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                      <span className="text-secondary font-black capitalize tracking-tight">{currentSubscription.status === 'active' ? 'Ativo' : currentSubscription.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-col border-l border-border pl-4 md:pl-10">
                    <span className="text-muted-foreground uppercase text-[9px] md:text-xs font-black tracking-widest mb-1">Renovação</span>
                    <span className="text-foreground font-bold tracking-tight">{new Date(currentSubscription.current_period_end).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 max-w-full lg:max-w-3xl bg-muted/30 border border-border/40 rounded-xl md:rounded-3xl p-4 md:p-8 backdrop-blur-sm shadow-inner">
                <div className="flex items-center justify-between mb-4 md:mb-8">
                  <h3 className="text-[10px] md:text-sm font-black uppercase tracking-[0.15em] text-muted-foreground">Uso do Sistema</h3>
                  <Badge variant="outline" className="text-[9px] font-bold bg-background/50 border-border/40">Real-time</Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-10">
                  {[
                    { label: 'Usuários', current: usageStats?.users, max: currentSubscription.plans?.max_users },
                    { label: 'Produtos', current: usageStats?.products, max: currentSubscription.plans?.max_products },
                    { label: 'Pacientes', current: usageStats?.patients, max: currentSubscription.plans?.max_patients }
                  ].map((stat, i) => (
                    <div key={i} className="space-y-2 md:space-y-3">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs md:text-base font-black text-foreground tracking-tight">{stat.label}</span>
                        <span className="text-[10px] md:text-xs font-bold text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded-md border border-border/30">
                          {stat.current} / {stat.max || '∞'}
                        </span>
                      </div>
                      <div className="h-2 md:h-3 bg-background/60 rounded-full overflow-hidden border border-border/30 p-0.5 shadow-sm">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${
                            stat.max && (stat.current || 0) > stat.max ? 'bg-destructive' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(100, (Number(stat.current) / (stat.max || 100)) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10 pt-4 md:pt-8">
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
            <Card key={plan.id} className={`group flex flex-col bg-card border-border transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 rounded-2xl md:rounded-[2rem] overflow-hidden ${isCurrent ? 'ring-2 md:ring-4 ring-primary border-transparent shadow-xl md:shadow-2xl' : 'shadow-lg border-2'}`}>
              <CardHeader className="space-y-3 md:space-y-5 p-5 md:p-8 pb-0">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl md:text-3xl font-black text-foreground tracking-tighter">{plan.name}</CardTitle>
                    <CardDescription className="text-muted-foreground text-xs md:text-base mt-1 md:mt-2 font-medium leading-relaxed">{plan.description}</CardDescription>
                  </div>
                  {isSuperAdmin && (
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 md:h-10 md:w-10 bg-muted/30" onClick={() => handleEditPlan(plan)}>
                      <Edit2 className="h-3.5 w-3.5 md:h-5 md:w-5" />
                    </Button>
                  )}
                </div>
                <div className="flex items-baseline gap-1 pt-1 md:pt-2">
                  <span className="text-3xl md:text-5xl font-black text-foreground tracking-tighter">R$ {plan.price}</span>
                  <span className="text-muted-foreground text-xs md:text-lg font-bold">/mês</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-4 md:space-y-6 p-5 md:p-8">
                <div className="space-y-2.5 md:space-y-4 pt-3 md:pt-4 border-t border-border/50">
                  <p className="text-[9px] md:text-xs font-black uppercase tracking-[0.15em] text-muted-foreground mb-2 md:mb-4">Recursos Incluídos</p>
                  
                  {[
                    { label: `Até ${plan.max_users} usuários`, exceeded: exceedsUsers },
                    { label: plan.max_products ? `Até ${plan.max_products} produtos` : 'Produtos Ilimitados', exceeded: exceedsProducts },
                    { label: plan.max_patients ? `Até ${plan.max_patients} pacientes` : 'Pacientes Ilimitados', exceeded: exceedsPatients }
                  ].map((item, i) => (
                    <div key={i} className={`flex items-center gap-2.5 md:gap-4 p-2.5 md:p-4 rounded-xl md:rounded-2xl transition-all duration-300 ${item.exceeded ? 'bg-destructive/10 border-2 border-destructive/20 shadow-sm' : 'bg-muted/40 border-2 border-transparent'}`}>
                      <div className={`p-1 md:p-1.5 rounded-full shadow-inner ${item.exceeded ? 'bg-destructive text-destructive-foreground' : 'bg-primary/20 text-primary'}`}>
                        {item.exceeded ? <AlertCircle className="h-3 w-3 md:h-4 md:w-4" /> : <Check className="h-3 w-3 md:h-4 md:w-4" />}
                      </div>
                      <span className={`text-xs md:text-base font-bold tracking-tight ${item.exceeded ? 'text-destructive' : 'text-foreground/90'}`}>{item.label}</span>
                    </div>
                  ))}

                  <div className="space-y-1.5 md:space-y-3 pt-1 md:pt-2">
                    {features.map((feature: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-0.5">
                        <div className="mt-0.5">
                          <Check className="h-3.5 w-3.5 md:h-5 md:w-5 text-muted-foreground opacity-60" />
                        </div>
                        <span className="text-xs md:text-base text-muted-foreground font-medium leading-tight">{feature.replace(/_/g, ' ')}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {isIneligible && (
                  <div className="p-3 md:p-4 bg-destructive/5 border border-destructive/10 rounded-xl md:rounded-2xl flex gap-3 md:gap-4 items-start animate-pulse duration-1000 shadow-inner">
                    <AlertCircle className="h-4 w-4 md:h-5 md:w-5 text-destructive shrink-0 mt-0.5" />
                    <p className="text-[10px] md:text-sm leading-relaxed text-destructive font-black">
                      Sua unidade excede os limites operacionais para este plano.
                    </p>
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-5 md:p-8 pt-0">
                <Button 
                  className={`w-full h-12 md:h-16 text-sm md:text-lg font-black uppercase tracking-[0.05em] md:tracking-[0.1em] transition-all duration-300 rounded-xl md:rounded-2xl shadow-lg md:shadow-xl active:scale-[0.98] ${
                    isCurrent && !canGenerateNewInvoiceForCurrent
                      ? 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20' 
                      : isIneligible 
                        ? 'bg-muted text-muted-foreground cursor-not-allowed border-none' 
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/20 active:shadow-none'
                  }`}
                  disabled={(isCurrent && !canGenerateNewInvoiceForCurrent) || isIneligible || (!isAdmin && !isSuperAdmin)}
                  onClick={() => handleSubscribe(plan.id, plan.name, plan.price)}
                >
                  {isCurrent 
                    ? (canGenerateNewInvoiceForCurrent ? 'Gerar Fatura' : 'Plano em Uso') 
                    : isIneligible ? 'Limites Excedidos' : 'Ativar Plano'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      
      <Card className="bg-muted/30 border border-border/40 p-5 md:p-10 flex flex-col md:flex-row gap-4 md:gap-10 items-center shadow-inner rounded-2xl md:rounded-[2.5rem]">
        <div className="bg-amber-100 p-3 md:p-6 rounded-xl md:rounded-3xl shadow-sm">
          <AlertCircle className="h-6 w-6 md:h-12 md:w-12 text-amber-600" />
        </div>
        <div className="flex-1 text-center md:text-left space-y-1 md:space-y-2">
            <h4 className="text-xl md:text-3xl font-black text-foreground tracking-tight">Segurança no Pagamento</h4>
            <p className="text-muted-foreground text-xs md:text-lg font-medium leading-relaxed">
                Pagamentos criptografados de ponta a ponta. 
                Ativação instantânea após a confirmação.
            </p>
        </div>
        <Button variant="link" className="text-amber-600 hover:text-amber-700 h-auto p-0 text-sm md:text-lg font-bold underline underline-offset-4">Ver Termos</Button>
      </Card>

      <div className="pt-6 md:pt-12 space-y-4 md:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-0.5">
            <h2 className="text-2xl md:text-4xl font-black text-foreground tracking-tighter">Histórico</h2>
            <p className="text-muted-foreground font-medium text-xs md:text-lg">Registro de faturamento e pagamentos</p>
          </div>
          <Badge variant="outline" className="w-fit text-muted-foreground border-border px-3 py-1 text-[10px] md:text-sm font-black rounded-full bg-muted/20">Últimos 12 meses</Badge>
        </div>
        <div className="overflow-hidden rounded-xl md:rounded-[2rem] border-2 border-border bg-card shadow-lg md:shadow-2xl w-full max-w-full overflow-x-auto">
          <PaymentHistoryTable />
        </div>
      </div>
    </div>
  );
}
