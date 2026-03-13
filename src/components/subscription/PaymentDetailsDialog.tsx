import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, QrCode } from 'lucide-react';

interface PaymentDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pixCode: string;
  qrCodeUrl?: string;
  pixId?: string;
  planName?: string;
}

export function PaymentDetailsDialog({ 
  isOpen, 
  onClose, 
  pixCode, 
  qrCodeUrl, 
  pixId,
  planName 
}: PaymentDetailsDialogProps) {
  const { toast } = useToast();

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
             <QrCode className="h-5 w-5" />
             Pagamento PIX Gerado {planName ? `- Plano ${planName}` : ''}
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code ou copie a chave PIX abaixo para pagar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center justify-center gap-4 border rounded-lg p-6 bg-muted/30">
            {qrCodeUrl && (
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <img src={qrCodeUrl} alt="QR Code PIX" className="w-48 h-48" />
              </div>
            )}
            
            <div className="w-full space-y-2">
              <Label>Código PIX (Copia e Cola)</Label>
              <div className="flex gap-2">
                <Input 
                  readOnly 
                  value={pixCode} 
                  className="font-mono text-xs bg-muted h-9 hidden md:block" 
                />
                <Input 
                  readOnly 
                  value={truncatePix(pixCode)} 
                  className="font-mono text-xs bg-muted h-9 md:hidden" 
                />
                <Button 
                  type="button" 
                  variant="default" 
                  size="icon" 
                  onClick={() => copyToClipboard(pixCode)}
                  title="Copiar Código"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {pixId && (
              <div className="w-full flex justify-between items-center text-xs text-muted-foreground border-t pt-2 mt-2">
                <span>ID da Transação:</span>
                <span className="font-mono">{pixId}</span>
              </div>
            )}
          </div>

          <div className="bg-blue-50 p-4 rounded-md flex gap-3 items-start border border-blue-200">
              <Check className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                  <h4 className="font-semibold text-blue-800 text-sm">Próximos Passos</h4>
                  <p className="text-xs text-blue-700 mt-1">
                      Após o pagamento, seu plano será ativado automaticamente em alguns instantes.
                      Você pode fechar esta janela e acompanhar o status no Histórico de Pagamentos.
                  </p>
              </div>
          </div>

          <DialogFooter>
              <Button onClick={onClose} className="w-full">
                  Entendi, já copiei o código
              </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
