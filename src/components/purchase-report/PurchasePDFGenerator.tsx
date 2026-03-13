
import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import type { PurchaseItem } from '@/types/purchase';

interface PurchasePDFGeneratorProps {
  items: PurchaseItem[];
  disabled?: boolean;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}

export function PurchasePDFGenerator({ items, disabled, variant, className }: PurchasePDFGeneratorProps) {
  const { user } = useAuth();

  const generatePDF = () => {
    // Criar conteúdo HTML para impressão
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Compras - UBSF</title>
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
            margin-top: 50px;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #333;
            width: 300px;
            margin: 20px auto 10px;
          }
          @media print {
            body { margin: 1cm; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>UNIDADE BÁSICA DE SAÚDE FLUVIAL</h1>
          <p>Relatório de Produtos para Compra</p>
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
            <li>Este relatório foi gerado automaticamente pelo sistema de farmácia da UBSF.</li>
            <li>Conferir disponibilidade e preços antes da efetivação da compra.</li>
            <li>Manter comprovantes de compra para controle de estoque.</li>
          </ul>
        </div>

        <div class="signature">
          <div class="signature-line"></div>
          <p>Assinatura do Responsável</p>
        </div>
      </body>
      </html>
    `;

    // Criar um iframe oculto para impressão (mais robusto que window.open)
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

      // Aguardar o carregamento do conteúdo no iframe
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        
        // Remover o iframe após a impressão (ou cancelamento)
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);
    }
  };

  return (
    <Button
      onClick={generatePDF}
      disabled={disabled || items.length === 0}
      variant={variant || "default"}
      className={className || "w-full md:w-auto"}
    >
      <Download className="h-4 w-4 mr-2" />
      Gerar PDF ({items.length})
    </Button>
  );
}
