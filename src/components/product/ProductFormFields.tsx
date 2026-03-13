
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useProductValidation } from "./hooks/useProductValidation";

interface ProductFormFieldsProps {
  formData: {
    descricao: string;
    codigo: string;
    unidade_medida: string;
  };
  onFormDataChange: (data: any) => void;
  unidadesMedida: { value: string; label: string }[];
  editingProductId?: string;
}

export function ProductFormFields({ formData, onFormDataChange, unidadesMedida, editingProductId }: ProductFormFieldsProps) {
  const { isValidating, isDuplicate, suggestedCodes } = useProductValidation({
    codigo: formData.codigo,
    editingProductId
  });
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <div className="space-y-1.5 md:space-y-2">
        <Label htmlFor="descricao" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição do Produto *</Label>
        <Input
          id="descricao"
          value={formData.descricao}
          onChange={(e) => onFormDataChange(prev => ({ ...prev, descricao: e.target.value }))}
          placeholder="Ex: Dipirona 500mg"
          required
          className="h-12 text-[16px]"
        />
      </div>

      <div className="space-y-1.5 md:space-y-2">
        <Label htmlFor="codigo" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Código do Produto *</Label>
        <div className="relative">
          <Input
            id="codigo"
            value={formData.codigo}
            onChange={(e) => onFormDataChange(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
            placeholder="Ex: DIP500"
            required
            className={`h-12 text-[16px] ${isDuplicate ? "border-red-500" : ""}`}
          />
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            {isValidating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {!isValidating && formData.codigo.length >= 3 && !isDuplicate && (
              <CheckCircle className="h-4 w-4 text-green-500" />
            )}
            {!isValidating && isDuplicate && (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
        </div>
        
        {isDuplicate && (
          <Alert variant="destructive" className="mt-2 rounded-xl">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Este código já existe no sistema.
              {suggestedCodes.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-bold mb-1">Sugestões:</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestedCodes.map((suggestion) => (
                      <Button
                        key={suggestion}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onFormDataChange(prev => ({ ...prev, codigo: suggestion }))}
                        className="h-8 text-[11px] font-bold"
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="space-y-1.5 md:space-y-2">
        <Label htmlFor="unidade_medida" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unidade de Medida *</Label>
        <Select 
          value={formData.unidade_medida} 
          onValueChange={(value: string) => 
            onFormDataChange(prev => ({ ...prev, unidade_medida: value }))
          }
        >
          <SelectTrigger className="h-12 text-[16px]">
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
