import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Check, QrCode, AlertCircle } from 'lucide-react';

import { PaymentDetailsDialog } from './PaymentDetailsDialog';

interface SubscriptionFormProps {
  planName: string;
  planId: string;
  planPrice: number;
  subscriptionId?: string;
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  full_name: string;
  email: string;
  phone: string;
  document: string;
  company_name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
}

export function SubscriptionForm({ planName, planId, planPrice, subscriptionId, isOpen, onClose }: SubscriptionFormProps) {
  const { user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [missingTenant, setMissingTenant] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{
    pixCode: string;
    qrCodeUrl?: string;
    pixId?: string;
  } | null>(null);
  const queryClient = useQueryClient();
  
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>();

  useEffect(() => {
    if (isOpen && user) {
      if (!user.tenant_id) {
        setMissingTenant(true);
        refreshProfile(); // Tentar atualizar o perfil caso o tenant tenha sido criado recentemente
        return;
      }
      setMissingTenant(false);

      // Pre-fill user data
      setValue('full_name', user.nome || '');
      setValue('email', user.email || '');
      
      // Fetch tenant details to pre-fill
      const fetchTenantDetails = async () => {
        if (!user.tenant_id) return;
        
        const { data: tenant } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', user.tenant_id)
          .single();
          
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single();

        if (tenant) {
          setValue('company_name', tenant.name);
          setValue('document', tenant.document || '');
          setValue('address', tenant.address || '');
          setValue('city', tenant.city || '');
          setValue('state', tenant.state || '');
          setValue('postal_code', tenant.postal_code || '');
          // Prefer tenant phone, fallback to profile phone
          setValue('phone', tenant.phone || profile?.phone || '');
        }
      };

      fetchTenantDetails();
    }
  }, [isOpen, user, setValue]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Código PIX copiado para a área de transferência.",
    });
  };

  const truncatePix = (pix: string) => {
    if (pix.length <= 30) return pix;
    return `${pix.substring(0, 15)}...${pix.substring(pix.length - 15)}`;
  };

  const validateCPF = (cpf: string) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length !== 11) return false;
    if (/^(\d)\1+$/.test(cleanCPF)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
    }
    let rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCPF.charAt(9))) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
    }
    rev = 11 - (sum % 11);
    if (rev === 10 || rev === 11) rev = 0;
    if (rev !== parseInt(cleanCPF.charAt(10))) return false;
    
    return true;
  };

  const validateCNPJ = (cnpj: string) => {
    const cleanCNPJ = cnpj.replace(/\D/g, '');
    if (cleanCNPJ.length !== 14) return false;
    if (/^(\d)\1+$/.test(cleanCNPJ)) return false;

    let size = cleanCNPJ.length - 2;
    let numbers = cleanCNPJ.substring(0, size);
    const digits = cleanCNPJ.substring(size);
    let sum = 0;
    let pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    size = size + 1;
    numbers = cleanCNPJ.substring(0, size);
    sum = 0;
    pos = size - 7;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(1))) return false;

    return true;
  };

  const formatDocument = (value: string) => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length <= 11) {
      return cleanValue
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return cleanValue
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      if (!user?.tenant_id) throw new Error("Tenant ID not found");

      // Document Validation
      const cleanDoc = data.document.replace(/\D/g, '');
      if (cleanDoc.length === 11) {
        if (!validateCPF(cleanDoc)) {
          toast({
            title: "CPF Inválido",
            description: "Por favor, informe um CPF válido para prosseguir.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
      } else if (cleanDoc.length === 14) {
        if (!validateCNPJ(cleanDoc)) {
          toast({
            title: "CNPJ Inválido",
            description: "Por favor, informe um CNPJ válido para prosseguir.",
            variant: "destructive"
          });
          setIsLoading(false);
          return;
        }
      } else {
        toast({
          title: "Documento Inválido",
          description: "O documento deve ser um CPF (11 dígitos) ou CNPJ (14 dígitos).",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      const formattedDoc = formatDocument(cleanDoc);

      // 1. Update Tenant Details
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({
          name: data.company_name,
          document: formattedDoc,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          postal_code: data.postal_code
        })
        .eq('id', user.tenant_id);

      if (tenantError) throw tenantError;

      // 1.5 Prepare Dates for Subscription and Invoice
      // Faturamento: Hoje (Data da adesão)
      // Vencimento: Amanhã às 23:59
      // Próximo Ciclo: 1 mês após o Vencimento às 23:59
      const today = new Date();
      
      const nextCycleDate = new Date(today);
      nextCycleDate.setDate(today.getDate() + 1);
      nextCycleDate.setHours(23, 59, 0, 0);
      
      const paymentDateFuture = new Date(nextCycleDate);
      paymentDateFuture.setMonth(paymentDateFuture.getMonth() + 1);

      // 2. Update the plan_id and periods in the subscriptions table
      console.log('[SubscriptionForm] Atualizando plano da assinatura...', { subscriptionId, planId, tenantId: user.tenant_id });
      
      const subQuery = supabase
        .from('subscriptions')
        .update({ 
          plan_id: planId,
          status: 'active',
          current_period_start: today.toISOString(),
          current_period_end: nextCycleDate.toISOString() // Renovação mostra o próximo vencimento
        });

      if (subscriptionId) {
        subQuery.eq('id', subscriptionId);
      } else {
        subQuery.eq('tenant_id', user.tenant_id);
      }

      const { data: subData, error: subUpdateError } = await subQuery.select();

      if (subUpdateError) {
        console.error('[SubscriptionForm] Erro ao atualizar plano da assinatura:', subUpdateError);
        throw subUpdateError;
      }

      if (!subData || subData.length === 0) {
        console.warn('[SubscriptionForm] Nenhuma assinatura foi atualizada. Verifique permissões RLS ou se o ID existe.');
        throw new Error("Não foi possível atualizar o plano ativo. O banco de dados recusou a alteração.");
      }

      console.log('[SubscriptionForm] Assinatura atualizada com sucesso:', subData[0]);

      // 3. Update Profile Phone (if needed)
      await supabase
        .from('profiles')
        .update({ phone: data.phone })
        .eq('id', user.id);

      // 4. Create Invoice (Waiting for first invoice)
      const { data: invoice, error: invoiceError } = await supabase
        .from('subscription_invoices')
        .insert({
            tenant_id: user.tenant_id,
            subscription_id: subscriptionId || subData[0].id,
            plan_id: planId,
            amount: planPrice,
            status: 'waiting',
            due_date: nextCycleDate.toISOString(),
            next_cycle_date: paymentDateFuture.toISOString(),
            created_at: today.toISOString()
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // 5. Construct n8n Payload
      console.log('[SubscriptionForm] Preparando payload n8n...');
      const n8nWebhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;
      
      if (!n8nWebhookUrl || n8nWebhookUrl === '#') {
        throw new Error("Link de pagamento não configurado (VITE_N8N_WEBHOOK_URL)");
      }

      // Payload simplificado e tipado para JSON
      const payload = {
        invoice_id: invoice.id,
        plan_id: planId,
        plan_name: planName,
        tenant_id: user.tenant_id,
        user_id: user.id,
        amount: Number(planPrice),
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        document: formattedDoc,
        company_name: data.company_name,
        address: data.address,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code
      };

      console.log('[SubscriptionForm] Payload que será enviado ao n8n:', payload);

      // 4. Send Data to n8n (POST)
      console.log('[SubscriptionForm] Enviando dados para n8n:', n8nWebhookUrl);
      const response = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const responseText = await response.text();
      console.log('[SubscriptionForm] Resposta bruta do servidor:', responseText);

      if (!response.ok) {
        console.error('[SubscriptionForm] Erro detalhado n8n:', response.status, responseText);
        throw new Error(`Falha ao comunicar com o servidor de pagamentos (${response.status}).`);
      }

      let result;
      try {
        result = responseText ? JSON.parse(responseText) : {};
      } catch (e) {
        console.warn('[SubscriptionForm] Resposta não é um JSON válido:', responseText);
        result = {};
      }
      
      console.log('[SubscriptionForm] Resultado processado:', result);
      
      // Mapeamento do novo formato n8n (img 1)
      const pixCode = result['chave-pix-copia-cola'] || result.pix_code || result.pixCode;
      const qrCodeUrl = result['qr-code'] || result.pix_qr_code_url || result.qrCodeUrl;
      const pixId = result['id-pix'] || result.pix_id || result.pixId;

      if (pixCode) {
          console.log('[SubscriptionForm] Atualizando fatura com dados do PIX...', { pixCode, qrCodeUrl, pixId });
          const { error: updateError } = await supabase
            .from('subscription_invoices')
            .update({ 
                pix_code: pixCode,
                pix_qr_code_url: qrCodeUrl,
                pix_id: pixId
            })
            .eq('id', invoice.id)
            .eq('tenant_id', user.tenant_id); // Security enforcement
            
          if (updateError) {
             console.error('[SubscriptionForm] Erro ao atualizar fatura com PIX:', updateError);
             throw updateError;
          }

          setPaymentResult({ pixCode, qrCodeUrl, pixId });
          // Invalida as queries necessárias para atualizar a interface
          await queryClient.invalidateQueries({ queryKey: ['my-invoices', user.tenant_id] });
          await queryClient.invalidateQueries({ queryKey: ['my-subscription', user.tenant_id] });
          
          toast({
            title: "Pedido gerado com sucesso!",
            description: "Realize o pagamento para ativar seu plano.",
          });
      } else {
         console.warn('[SubscriptionForm] Webhook retornou sucesso mas sem pix_code:', result);
         // Fallback se não vier pix code
         onClose();
      }

    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro ao processar",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPaymentResult(null);
    onClose();
  };

  if (paymentResult) {
    return (
      <PaymentDetailsDialog 
        isOpen={true} 
        onClose={handleClose}
        pixCode={paymentResult.pixCode}
        qrCodeUrl={paymentResult.qrCodeUrl}
        pixId={paymentResult.pixId}
        planName={planName}
      />
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-white shadow-2xl">
        <DialogHeader>
          <div className="bg-emerald-500/10 w-fit p-3 rounded-2xl mb-4">
            <QrCode className="h-6 w-6 text-emerald-500" />
          </div>
          <DialogTitle className="text-2xl font-bold tracking-tight">Finalizar Assinatura - Plano {planName}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Preencha os dados da sua organização para gerar o faturamento e ativar seu acesso.
          </DialogDescription>
        </DialogHeader>

        {missingTenant ? (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-6 rounded-xl flex flex-col gap-4 mt-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5" />
              <p className="font-bold uppercase tracking-widest text-xs">Atenção Necessária</p>
            </div>
            <p className="text-sm leading-relaxed">Não foi possível identificar sua organização. Isso geralmente ocorre quando o cadastro inicial não foi concluído corretamente.</p>
            <Button 
              variant="destructive" 
              className="w-full bg-rose-600 hover:bg-rose-700 font-bold uppercase tracking-widest text-[10px]"
              onClick={() => window.location.href = '/onboarding'}
            >
              Concluir Cadastro da Empresa
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-slate-400 text-xs font-bold uppercase tracking-widest">Responsável</Label>
              <Input id="full_name" className="bg-slate-950 border-slate-800 focus:border-emerald-500 transition-colors" {...register('full_name', { required: true })} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-400 text-xs font-bold uppercase tracking-widest">E-mail de Cobrança</Label>
              <Input id="email" type="email" {...register('email', { required: true })} readOnly className="bg-slate-800/50 border-slate-800 text-slate-500 cursor-not-allowed" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-slate-400 text-xs font-bold uppercase tracking-widest">WhatsApp / Telefone</Label>
              <Input id="phone" className="bg-slate-950 border-slate-800 focus:border-emerald-500" {...register('phone', { required: true })} placeholder="(00) 00000-0000" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="document" className="text-slate-400 text-xs font-bold uppercase tracking-widest">CPF ou CNPJ</Label>
              <Input 
                id="document" 
                className="bg-slate-950 border-slate-800 focus:border-emerald-500" 
                {...register('document', { 
                  required: true,
                  onChange: (e) => {
                    const { value } = e.target;
                    e.target.value = formatDocument(value);
                  }
                })} 
                placeholder="000.000.000-00 ou 00.000.000/0000-00" 
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="company_name" className="text-slate-400 text-xs font-bold uppercase tracking-widest">Nome da Unidade / Razão Social</Label>
            <Input id="company_name" className="bg-slate-950 border-slate-800 focus:border-emerald-500" {...register('company_name', { required: true })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="text-slate-400 text-xs font-bold uppercase tracking-widest">Endereço Completo</Label>
            <Input id="address" className="bg-slate-950 border-slate-800 focus:border-emerald-500" {...register('address', { required: true })} placeholder="Logradouro, número, bairro" />
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-1 space-y-2">
              <Label htmlFor="postal_code" className="text-slate-400 text-xs font-bold uppercase tracking-widest">CEP</Label>
              <Input id="postal_code" className="bg-slate-950 border-slate-800 focus:border-emerald-500" {...register('postal_code', { required: true })} />
            </div>
            <div className="col-span-1 space-y-2">
              <Label htmlFor="city" className="text-slate-400 text-xs font-bold uppercase tracking-widest">Cidade</Label>
              <Input id="city" className="bg-slate-950 border-slate-800 focus:border-emerald-500" {...register('city', { required: true })} />
            </div>
            <div className="col-span-1 space-y-2">
              <Label htmlFor="state" className="text-slate-400 text-xs font-bold uppercase tracking-widest">UF</Label>
              <Input id="state" className="bg-slate-950 border-slate-800 focus:border-emerald-500" {...register('state', { required: true })} maxLength={2} placeholder="UF" />
            </div>
          </div>

          <div className="flex items-center gap-2 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-200/70 leading-relaxed">
              Ao prosseguir, você concorda com os termos de uso e faturamento. A fatura será gerada e o código PIX será exibido na próxima tela.
            </p>
          </div>

          <DialogFooter className="mt-8 gap-3">
            <Button type="button" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest px-8">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gerar Faturamento
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
