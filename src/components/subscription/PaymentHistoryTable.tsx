import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QrCode, Copy, Check, Trash2, Eye, RotateCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PaymentDetailsDialog } from './PaymentDetailsDialog';

function getInvoiceUiStatus(invoice: { status: string; due_date?: string | null }) {
  if (invoice.status === 'paid' || invoice.status === 'failed' || invoice.status === 'pending') {
    return invoice.status;
  }

  if (!invoice.due_date) {
    return invoice.status;
  }

  const now = new Date();
  const dueDate = new Date(invoice.due_date);

  if (Number.isNaN(dueDate.getTime())) {
    return invoice.status;
  }

  if (now <= dueDate) {
    return 'waiting';
  }

  const diffTime = now.getTime() - dueDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 10 ? 'pending' : 'late';
}

function getNextManualStatus(currentStatus: string) {
  if (currentStatus === 'waiting') return 'pending';
  if (currentStatus === 'pending') return 'paid';
  if (currentStatus === 'paid') return 'waiting';
  return 'paid';
}

export function PaymentHistoryTable() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string | null>(null);

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['my-invoices', user?.tenant_id],
    queryFn: async () => {
      if (!user?.tenant_id) return [];
      
      // Forçar atualização de status (Aguardando -> Pendente) antes de buscar
      await supabase.rpc('is_tenant_blocked', { p_tenant_id: user.tenant_id });
      
      const { data, error } = await supabase
        .from('subscription_invoices')
        .select('*, plans(name)')
        .eq('tenant_id', user.tenant_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      return data;
    },
    enabled: !!user?.tenant_id
  });

  const selectedInvoice = React.useMemo(() => {
    if (!selectedInvoiceId || !invoices) return null;
    return invoices.find(inv => inv.id === selectedInvoiceId) || null;
  }, [selectedInvoiceId, invoices]);

  const handleToggleStatus = async (invoiceId: string, currentStatus: string) => {
    if (!user?.tenant_id) {
      toast({ title: "Erro", description: "Sessão inválida. Recarregue a página.", variant: "destructive" });
      return;
    }

    // Restrição: Apenas SUPER_ADMIN pode alterar status
    if (user.tipo !== 'SUPER_ADMIN') {
      toast({
        title: "Acesso Negado",
        description: "Apenas o proprietário do sistema pode confirmar pagamentos.",
        variant: "destructive"
      });
      return;
    }

    const newStatus = getNextManualStatus(currentStatus);

    console.log('[PaymentHistoryTable] Mudança manual Super Admin:', { de: currentStatus, para: newStatus });

    const paymentDate = newStatus === 'paid' ? new Date().toISOString() : null;
    
    // Preparar payload de atualização
    const updatePayload: any = {
      status: newStatus,
      payment_date: paymentDate
    };

    // REGRA DE NEGÓCIO: Injeção de Dados Fictícios para Testes do Super Admin
    // Se a fatura está sendo marcada como paga e não tem os dados do PIX (nunca foi enviada ao n8n),
    // nós inserimos dados falsos para garantir que os gatilhos e integrações funcionem como se fosse real.
    if (newStatus === 'paid') {
      const invoice = invoices?.find(inv => inv.id === invoiceId);
      if (invoice && !invoice.pix_id) {
        updatePayload.pix_id = `TESTE_MANUAL_${Math.random().toString(36).substring(7)}`;
        updatePayload.pix_code = "00020101021226800014br.gov.bcb.pix2558pix.mentoriajrs.com/teste-manual-super-admin";
        updatePayload.pix_qr_code_url = "https://mentoriajrs.com/pix-teste.png";
        console.log('[PaymentHistoryTable] Injetando dados PIX fictícios para homologação');
      }
    }

    // IMPORTANTE: Para o Super Admin conseguir editar, precisamos garantir que ele 
    // ignore o filtro de tenant_id se estiver editando uma fatura de outro tenant
    const { error } = await supabase
      .from('subscription_invoices')
      .update(updatePayload)
      .eq('id', invoiceId); // Removido filtro de tenant_id para Super Admin global access

    if (error) {
      console.error('[PaymentHistoryTable] Erro ao atualizar status:', error);
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const statusLabel =
        newStatus === 'paid' ? 'Pago' :
        newStatus === 'pending' ? 'Pendente' :
        newStatus === 'waiting' ? 'Aguardando' :
        newStatus;
      toast({
        title: "Status atualizado",
        description: `Fatura marcada como ${statusLabel}.`,
      });
      // Forçar atualização imediata do cache e refetch
      await queryClient.invalidateQueries({ queryKey: ['my-invoices'] });
      await refetch();
    }
  };

  const handleGeneratePix = async (invoice: any) => {
    if (invoice.status === 'paid') return;
    
    toast({
      title: "Gerando PIX...",
      description: "Aguarde enquanto processamos seu código de pagamento.",
    });

    try {
      const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      
      // Fetch tenant and plan details
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', user?.tenant_id)
        .single();

      // Buscando o nome do plano de forma independente para garantir que não venha vazio
      let planName = invoice.plans?.name || '';
      let planId = invoice.plan_id;

      // Se não tem plan_id na fatura (faturas legadas), busca da assinatura ativa
      if (!planId) {
        const { data: subData } = await supabase
          .from('subscriptions')
          .select('plan_id')
          .eq('id', invoice.subscription_id)
          .single();
        
        if (subData) {
          planId = subData.plan_id;
        }
      }

      if (!planName && planId) {
        const { data: planData } = await supabase
          .from('plans')
          .select('name')
          .eq('id', planId)
          .single();
        if (planData) {
          planName = planData.name;
        }
      }

      const payload = {
        invoice_id: invoice.id,
        plan_id: planId,
        plan_name: planName,
        plano_ativo: planName,
        plano: planName,
        nome_plano: planName,
        tenant_id: user?.tenant_id,
        user_id: user?.id,
        amount: Number(invoice.amount),
        full_name: user?.nome,
        email: user?.email,
        company_name: tenant?.name,
        phone: tenant?.phone,
        document: tenant?.document,
        address: tenant?.address,
        city: tenant?.city,
        state: tenant?.state,
        postal_code: tenant?.postal_code
      };

      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        result = {};
      }

      const pixCode = result['chave-pix-copia-cola'] || result.pix_code || result.pixCode;
      const qrCodeUrl = result['qr-code'] || result.pix_qr_code_url || result.qrCodeUrl;
      const pixId = result['id-pix'] || result.pix_id || result.pixId;

      if (pixCode) {
        const { error: updateError } = await supabase
          .from('subscription_invoices')
          .update({ 
              pix_code: pixCode,
              pix_qr_code_url: qrCodeUrl,
              pix_id: pixId
          })
          .eq('id', invoice.id)
          .eq('tenant_id', user?.tenant_id);
          
        if (updateError) throw updateError;

        await queryClient.invalidateQueries({ queryKey: ['my-invoices', user?.tenant_id] });
        refetch();
        setSelectedInvoiceId(invoice.id);
        
        toast({
          title: "PIX Gerado!",
          description: "O código foi atualizado com sucesso.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao gerar PIX",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!user?.tenant_id) return;
    
    // Restrição: Apenas SUPER_ADMIN pode excluir
    if (user.tipo !== 'SUPER_ADMIN') {
      toast({
        title: "Acesso Negado",
        description: "Apenas o proprietário do sistema pode excluir faturas.",
        variant: "destructive"
      });
      return;
    }

    if (!window.confirm("Tem certeza que deseja excluir esta fatura?")) return;

    const { error } = await supabase
      .from('subscription_invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('tenant_id', user.tenant_id); // Security enforcement

    if (error) {
      toast({
        title: "Erro ao excluir fatura",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Fatura excluída",
        description: "A fatura foi removida com sucesso.",
      });
      await queryClient.invalidateQueries({ queryKey: ['my-invoices', user?.tenant_id] });
      refetch();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Código PIX copiado para a área de transferência.",
    });
  };

  const truncatePix = (pix: string | null) => {
    if (!pix) return '';
    if (pix.length <= 20) return pix;
    return `${pix.substring(0, 10)}...${pix.substring(pix.length - 10)}`;
  };

  const handleViewDetails = (invoice: any) => {
    console.log('Detalhes da Fatura:', invoice);
    if (invoice.status === 'pending' && !invoice.pix_code) {
      toast({
        title: "Processando pagamento",
        description: "O código PIX está sendo gerado. Tente novamente em alguns instantes.",
      });
      return;
    }
    setSelectedInvoiceId(invoice.id);
  };

  if (isLoading) return <div className="text-center py-4">Carregando histórico...</div>;

  if (!invoices || invoices.length === 0) {
    return (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>Histórico de Pagamentos</CardTitle>
                <CardDescription>Nenhuma fatura encontrada.</CardDescription>
            </CardHeader>
        </Card>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-border bg-muted/50">
        <h3 className="text-lg font-bold text-foreground">Histórico de Cobrança</h3>
        <p className="text-muted-foreground text-sm">Faturas e comprovantes de pagamento</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] py-4">Vencimento</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] py-4">Valor</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] py-4">Situação</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] py-4">Próximo Ciclo</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] py-4">Pagamento</TableHead>
              <TableHead className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] py-4 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice, index) => {
              // ... existing logic ...
              
              let displayDueDate = invoice.due_date;
              let displayNextCycle = invoice.next_cycle_date;

              const previousInvoice = invoices[index + 1];
              if (previousInvoice && previousInvoice.next_cycle_date) {
                displayDueDate = previousInvoice.next_cycle_date;
              }

              if (!displayNextCycle && displayDueDate) {
                const date = new Date(displayDueDate);
                date.setMonth(date.getMonth() + 1);
                displayNextCycle = date.toISOString();
              } else if (displayDueDate && invoice.status === 'waiting') {
                const date = new Date(displayDueDate);
                date.setMonth(date.getMonth() + 1);
                displayNextCycle = date.toISOString();
              }

              const dynamicStatus = getInvoiceUiStatus({
                status: invoice.status,
                due_date: invoice.due_date ?? displayDueDate,
              });

              return (
                <TableRow key={invoice.id} className="border-border hover:bg-muted/30 transition-colors">
                  <TableCell className="text-foreground font-bold py-4">
                      <div className="flex flex-col">
                        <span>{displayDueDate ? new Date(displayDueDate).toLocaleDateString('pt-BR') : '-'}</span>
                        <span className="text-[10px] text-muted-foreground">23:59</span>
                      </div>
                  </TableCell>
                  <TableCell className="text-foreground font-bold py-4">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(invoice.amount))}
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge 
                      className={`
                        px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border-0
                        ${invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : ''}
                        ${dynamicStatus === 'pending' && invoice.status !== 'paid' ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' : ''}
                        ${dynamicStatus === 'late' && invoice.status !== 'paid' ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : ''}
                        ${dynamicStatus === 'waiting' && invoice.status !== 'paid' ? 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' : ''}
                        ${user?.tipo === 'SUPER_ADMIN' ? 'cursor-pointer' : 'cursor-default'}
                        transition-all
                      `}
                      onClick={() => user?.tipo === 'SUPER_ADMIN' && handleToggleStatus(invoice.id, invoice.status)}
                    >
                      <div className="flex items-center gap-1.5">
                        {invoice.status === 'paid' ? 'APROVADO' : 
                         dynamicStatus === 'pending' ? 'PENDENTE' : 
                         dynamicStatus === 'late' ? 'ATRASADO' : 
                         dynamicStatus === 'waiting' ? 'AGUARDANDO' : 
                         invoice.status === 'failed' ? 'FALHOU' : invoice.status}
                        {user?.tipo === 'SUPER_ADMIN' && <RotateCw className="h-2.5 w-2.5 opacity-50" />}
                      </div>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-foreground font-bold py-4">
                      <div className="flex flex-col">
                        <span>{displayNextCycle ? new Date(displayNextCycle).toLocaleDateString('pt-BR') : '-'}</span>
                        <span className="text-[10px] text-muted-foreground">23:59</span>
                      </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground py-4 font-mono text-xs">
                      {invoice.status === 'paid' && invoice.payment_date 
                        ? new Date(invoice.payment_date).toLocaleDateString('pt-BR') 
                        : '-'}
                  </TableCell>
                <TableCell className="text-right py-4">
                  <div className="flex justify-end gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleViewDetails(invoice)}
                      disabled={invoice.status === 'paid'}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => handleGeneratePix(invoice)}
                      disabled={invoice.status === 'paid'}
                      className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>

                    {invoice.status !== 'paid' && invoice.pix_code && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => copyToClipboard(invoice.pix_code!)}
                        className="h-8 border-border text-muted-foreground hover:bg-muted"
                      >
                        <Copy className="h-3.5 w-3.5 mr-2" />
                        PIX
                      </Button>
                    )}

                    {user?.tipo === 'SUPER_ADMIN' && (
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => handleDeleteInvoice(invoice.id)}
                        className="h-8 w-8 p-0 text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
        </Table>
      </div>

      {selectedInvoice && (
        <PaymentDetailsDialog
          isOpen={true}
          onClose={() => setSelectedInvoiceId(null)}
          pixCode={selectedInvoice.pix_code || ''}
          qrCodeUrl={selectedInvoice.pix_qr_code_url || ''}
          pixId={selectedInvoice.pix_id || ''}
        />
      )}
    </div>
  );
}
