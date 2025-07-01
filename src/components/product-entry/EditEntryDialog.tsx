
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductEntry } from '@/types';
import { format } from 'date-fns';

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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Entrada</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Produto</Label>
              <div className="p-2 bg-gray-50 rounded text-sm">
                {entry.produto?.descricao} ({entry.produto?.codigo})
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade *</Label>
              <Input
                id="quantidade"
                type="number"
                value={formData.quantidade}
                onChange={(e) => setFormData(prev => ({ ...prev, quantidade: e.target.value }))}
                required
                min="1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lote">Lote *</Label>
              <Input
                id="lote"
                value={formData.lote}
                onChange={(e) => setFormData(prev => ({ ...prev, lote: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vencimento">Data de Vencimento *</Label>
              <Input
                id="vencimento"
                type="date"
                value={formData.vencimento}
                onChange={(e) => setFormData(prev => ({ ...prev, vencimento: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_entrada">Data da Entrada *</Label>
              <Input
                id="data_entrada"
                type="date"
                value={formData.data_entrada}
                onChange={(e) => setFormData(prev => ({ ...prev, data_entrada: e.target.value }))}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
