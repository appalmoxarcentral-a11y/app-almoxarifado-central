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
        .select('*')
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

    // Lógica Simplificada: Alternar entre Pendente/Aguardando e Pago
    // Se clicar em qualquer um que não seja pago, vira PAGO.
    // Se clicar em PAGO, volta para PENDENTE (a automação cuidará de voltar para Aguardando se não estiver vencido)
    let newStatus = 'paid';
    if (currentStatus === 'paid') {
      newStatus = 'pending';
    }

    console.log('[PaymentHistoryTable] Mudança manual Super Admin:', { de: currentStatus, para: newStatus });

    const paymentDate = newStatus === 'paid' ? new Date().toISOString() : null;
    
    // IMPORTANTE: Para o Super Admin conseguir editar, precisamos garantir que ele 
    // ignore o filtro de tenant_id se estiver editando uma fatura de outro tenant
    const { error } = await supabase
      .from('subscription_invoices')
      .update({ 
        status: newStatus,
        payment_date: paymentDate
      })
      .eq('id', invoiceId); // Removido filtro de tenant_id para Super Admin global access

    if (error) {
      console.error('[PaymentHistoryTable] Erro ao atualizar status:', error);
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      const statusLabel = newStatus === 'paid' ? 'Pago' : newStatus === 'pending' ? 'Pendente' : 'Aguardando';
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
      
      // Fetch tenant details
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', user?.tenant_id)
        .single();

      const payload = {
        invoice_id: invoice.id,
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="p-6 border-b border-slate-800 bg-slate-950/50">
        <h3 className="text-lg font-bold text-white">Histórico de Cobrança</h3>
        <p className="text-slate-400 text-sm">Faturas e comprovantes de pagamento</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-slate-950/30">
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4">Vencimento</TableHead>
              <TableHead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4">Valor</TableHead>
              <TableHead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4">Situação</TableHead>
              <TableHead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4">Próximo Ciclo</TableHead>
              <TableHead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4">Pagamento</TableHead>
              <TableHead className="text-slate-400 font-bold uppercase tracking-widest text-[10px] py-4 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice, index) => {
              // Lógica de encadeamento de datas sugerida pelo usuário:
              // O Vencimento desta fatura deve ser o Próximo Ciclo da fatura anterior (se houver)
              // O Próximo Ciclo desta fatura deve ser 1 mês após o Vencimento
              
              let displayDueDate = invoice.due_date;
              let displayNextCycle = invoice.next_cycle_date;

              // Se houver uma fatura anterior (mais antiga na lista, ou seja, index + 1)
              const previousInvoice = invoices[index + 1];
              if (previousInvoice && previousInvoice.next_cycle_date) {
                displayDueDate = previousInvoice.next_cycle_date;
              }

              // Se o próximo ciclo estiver vazio ou for o caso de AGUARDANDO, calculamos 1 mês após o vencimento
              if (!displayNextCycle && displayDueDate) {
                const date = new Date(displayDueDate);
                date.setMonth(date.getMonth() + 1);
                displayNextCycle = date.toISOString();
              } else if (displayDueDate && invoice.status === 'waiting') {
                // Forçar 1 mês após o vencimento para faturas em aguardando para manter o padrão 18/04 -> 18/05
                const date = new Date(displayDueDate);
                date.setMonth(date.getMonth() + 1);
                displayNextCycle = date.toISOString();
              }

              return (
                <TableRow key={invoice.id} className="border-slate-800 hover:bg-slate-800/30 transition-colors">
                  <TableCell className="text-white font-bold py-4">
                      <div className="flex flex-col">
                        <span>{displayDueDate ? new Date(displayDueDate).toLocaleDateString('pt-BR') : '-'}</span>
                        <span className="text-[10px] text-slate-400">23:59</span>
                      </div>
                  </TableCell>
                  <TableCell className="text-white font-bold py-4">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(invoice.amount))}
                  </TableCell>
                  <TableCell className="py-4">
                    <Badge 
                      className={`
                        px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border-0
                        ${invoice.status === 'paid' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : ''}
                        ${invoice.status === 'pending' ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : ''}
                        ${invoice.status === 'waiting' ? 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20' : ''}
                        ${user?.tipo === 'SUPER_ADMIN' ? 'cursor-pointer' : 'cursor-default'}
                        transition-all
                      `}
                      onClick={() => user?.tipo === 'SUPER_ADMIN' && handleToggleStatus(invoice.id, invoice.status)}
                    >
                      <div className="flex items-center gap-1.5">
                        {invoice.status === 'paid' ? 'APROVADO' : 
                         invoice.status === 'pending' ? 'PENDENTE' : 
                         invoice.status === 'waiting' ? 'AGUARDANDO' : 
                         invoice.status === 'failed' ? 'Falhou' : invoice.status}
                        {user?.tipo === 'SUPER_ADMIN' && <RotateCw className="h-2.5 w-2.5 opacity-50" />}
                      </div>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white font-bold py-4">
                      <div className="flex flex-col">
                        <span>{displayNextCycle ? new Date(displayNextCycle).toLocaleDateString('pt-BR') : '-'}</span>
                        <span className="text-[10px] text-slate-400">23:59</span>
                      </div>
                  </TableCell>
                  <TableCell className="text-slate-400 py-4 font-mono text-xs">
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
                      className="h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
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
                        className="h-8 border-slate-700 text-slate-300 hover:bg-slate-800"
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
                        className="h-8 w-8 p-0 text-rose-500/50 hover:text-rose-500 hover:bg-rose-500/10"
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
