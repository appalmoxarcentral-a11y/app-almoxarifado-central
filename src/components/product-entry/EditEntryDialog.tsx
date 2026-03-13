
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductEntry } from '@/types';
import { format } from 'date-fns';
import { SmartDatePicker } from '@/components/ui/smart-date-picker';
import { Calendar as CalendarIcon, Package } from 'lucide-react';

interface EditEntryDialogProps {
  entry: ProductEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, data: any) => void;
  isLoading: boolean;
}

export function EditEntryDialog({ entry, isOpen, onClose, onSave, isLoading }: EditEntryDialogProps) {
  const [formData, setFormData] = useState({
    quantidade: '',
    lote: '',
    vencimento: '',
    data_entrada: ''
  });

  React.useEffect(() => {
    if (entry) {
      setFormData({
        quantidade: entry.quantidade.toString(),
        lote: entry.lote,
        vencimento: entry.vencimento,
        data_entrada: entry.data_entrada
      });
    }
  }, [entry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    onSave(entry.id, {
      quantidade: parseInt(formData.quantidade),
      lote: formData.lote,
      vencimento: formData.vencimento,
      data_entrada: formData.data_entrada
    });
  };

  if (!entry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl md:rounded-3xl border-border bg-card p-6">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="h-5 w-5 text-primary" />
            </div>
            Editar Entrada
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Produto</Label>
              <div className="p-3 bg-muted/50 border border-border/50 rounded-xl text-sm font-bold text-foreground/80">
                {entry.produto?.descricao} ({entry.produto?.codigo})
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantidade" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quantidade *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  value={formData.quantidade}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantidade: e.target.value }))}
                  required
                  min="1"
                  className="h-12 text-[16px] rounded-xl border-border bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lote" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Lote *</Label>
                <Input
                  id="lote"
                  value={formData.lote}
                  onChange={(e) => setFormData(prev => ({ ...prev, lote: e.target.value }))}
                  required
                  className="h-12 text-[16px] rounded-xl border-border bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="vencimento" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                Vencimento *
              </Label>
              <SmartDatePicker
                id="vencimento"
                value={formData.vencimento}
                onChange={(val) => setFormData(prev => ({ ...prev, vencimento: val }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_entrada" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <CalendarIcon className="h-3.5 w-3.5" />
                Data da Entrada *
              </Label>
              <SmartDatePicker
                id="data_entrada"
                value={formData.data_entrada}
                onChange={(val) => setFormData(prev => ({ ...prev, data_entrada: val }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading} className="h-12 rounded-xl font-bold border-border">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="h-12 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-primary/20">
              {isLoading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
