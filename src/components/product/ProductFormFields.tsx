
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnidadeMedida } from "@/types";

interface ProductFormFieldsProps {
  formData: {
    descricao: string;
    codigo: string;
    unidade_medida: UnidadeMedida;
  };
  onFormDataChange: (data: any) => void;
  unidadesMedida: { value: string; label: string }[];
}

export function ProductFormFields({ formData, onFormDataChange, unidadesMedida }: ProductFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição do Produto *</Label>
        <Input
          id="descricao"
          value={formData.descricao}
          onChange={(e) => onFormDataChange(prev => ({ ...prev, descricao: e.target.value }))}
          placeholder="Ex: Dipirona 500mg"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="codigo">Código do Produto *</Label>
        <Input
          id="codigo"
          value={formData.codigo}
          onChange={(e) => onFormDataChange(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
          placeholder="Ex: DIP500"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unidade_medida">Unidade de Medida *</Label>
        <Select 
          value={formData.unidade_medida} 
          onValueChange={(value: UnidadeMedida) => 
            onFormDataChange(prev => ({ ...prev, unidade_medida: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            {unidadesMedida.map((unidade) => (
              <SelectItem key={unidade.value} value={unidade.value}>
                {unidade.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
