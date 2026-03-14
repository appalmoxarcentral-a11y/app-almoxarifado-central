
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { PurchaseItem } from '@/types/purchase';

interface PurchasePDFGeneratorProps {
  items: PurchaseItem[];
  disabled?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}

export function PurchasePDFGenerator({ items, disabled, variant, className }: PurchasePDFGeneratorProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  const generatePDF = () => {
    // Definir nome da unidade
    const unidadeNome = user?.unidade_nome || 'SMSA';
    
    // Criar conteúdo HTML para impressão
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Compras - ${unidadeNome}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.4;
            color: #333;
          }
          .header { 
            text-align: center; 
            margin-bottom: 30px; 
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
          }
          .header h1 { 
            margin: 0; 
            color: #333; 
            font-size: 24px;
            text-transform: uppercase;
          }
          .header p { 
            margin: 5px 0; 
            color: #666; 
          }
          .info-section {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            background: #f5f5f5;
            padding: 10px;
            border-radius: 5px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 30px;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: left; 
          }
          th { 
            background-color: #f2f2f2; 
            font-weight: bold;
          }
          .text-center { text-align: center; }
          .codigo { font-family: monospace; font-size: 12px; }
          .footer {
            margin-top: 40px;
            border-top: 1px solid #ddd;
            padding-top: 20px;
          }
          .signature {
            margin-top: 60px;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #333;
            width: 300px;
            margin: 0 auto 5px;
          }
          .signature p {
            margin: 0;
            font-size: 14px;
          }
          @media print {
            body { margin: 1cm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${unidadeNome} - RELATÓRIO DE COMPRAS</h1>
          <p>Registro de Necessidades de Reposição</p>
        </div>
        
        <div class="info-section">
          <div>
            <strong>Data de Geração:</strong> ${format(new Date(), 'dd/MM/yyyy - HH:mm', { locale: ptBR })}
          </div>
          <div>
            <strong>Responsável:</strong> ${user?.nome || 'Não informado'}
          </div>
          <div>
            <strong>Total de Itens:</strong> ${items.length}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%">Código</th>
              <th style="width: 45%">Descrição do Produto</th>
              <th style="width: 10%" class="text-center">Unidade</th>
              <th style="width: 15%" class="text-center">Estoque Atual</th>
              <th style="width: 15%" class="text-center">Qtd. para Compra</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(item => `
              <tr>
                <td class="codigo">${item.codigo}</td>
                <td>${item.descricao}</td>
                <td class="text-center">${item.unidade_medida}</td>
                <td class="text-center">${item.estoque_atual}</td>
                <td class="text-center"><strong>${item.quantidade_reposicao}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p><strong>Observações:</strong></p>
          <ul>
            <li>Este relatório foi gerado automaticamente pelo sistema de farmácia da SMSA.</li>
            <li>Conferir disponibilidade e preços antes da efetivação da compra.</li>
            <li>Manter comprovantes de compra para controle de estoque.</li>
          </ul>
        </div>

        <div class="signature">
          <div class="signature-line"></div>
          <p><strong>${user?.nome || 'Responsável'}</strong></p>
        </div>
      </body>
      </html>
    `;

    if (isMobile) {
      // No mobile, abrir em uma nova janela é mais robusto para acionar o diálogo nativo de impressão
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Aguardar o carregamento e estilos
        setTimeout(() => {
          printWindow.print();
          // Opcional: fechar a janela após a impressão/cancelamento
          // printWindow.close();
        }, 800);
      }
    } else {
      // Criar um iframe oculto para impressão no desktop
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(printContent);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 500);
      }
    }
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={disabled || items.length === 0}
      variant={variant || "default"}
      className={cn("w-full md:w-auto flex items-center justify-center gap-1", className)}
    >
      <Download className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">PDF ({items.length})</span>
    </Button>
  );
}
