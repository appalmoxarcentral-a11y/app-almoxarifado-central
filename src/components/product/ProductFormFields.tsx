
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Loader2, Plus } from "lucide-react";
import { useProductValidation } from "./hooks/useProductValidation";
import { SearchableModal } from "@/components/ui/searchable-modal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

interface ProductFormFieldsProps {
  formData: {
    descricao: string;
    codigo: string;
    unidade_medida: string;
  };
  onFormDataChange: (data: any) => void;
  unidadesMedida: { value: string; label: string }[];
  editingProductId?: string;
  onUnitAdded?: () => void;
}

export function ProductFormFields({ formData, onFormDataChange, unidadesMedida, editingProductId, onUnitAdded }: ProductFormFieldsProps) {
  const queryClient = useQueryClient();
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const { isValidating, isDuplicate, suggestedCodes } = useProductValidation({
    codigo: formData.codigo,
    editingProductId
  });

  const handleAddUnit = async (descricao: string) => {
    if (!descricao.trim()) return;
    
    // Tenta extrair um código simples (ex: primeiras 2-3 letras)
    const suggestedCode = descricao.trim().substring(0, 3).toUpperCase();
    const finalCode = prompt(`Informe o código para a nova unidade "${descricao}":`, suggestedCode);
    
    if (!finalCode) return;

    setIsAddingUnit(true);
    try {
      const { error } = await supabase
        .from('unidades_medida')
        .insert([{ 
          codigo: finalCode.toUpperCase(), 
          descricao: descricao.trim(),
          ativo: true
        }]);

      if (error) throw error;

      toast({
        title: "Unidade adicionada!",
        description: `A unidade ${descricao} foi cadastrada com sucesso.`,
      });

      queryClient.invalidateQueries({ queryKey: ['unidades-medida-admin'] });
      onFormDataChange((prev: any) => ({ ...prev, unidade_medida: finalCode.toUpperCase() }));
      if (onUnitAdded) onUnitAdded();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar unidade",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAddingUnit(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
      <div className="space-y-1.5 md:space-y-2">
        <Label htmlFor="descricao" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição do Produto *</Label>
        <Input
          id="descricao"
          value={formData.descricao}
          onChange={(e) => onFormDataChange((prev: any) => ({ ...prev, descricao: e.target.value }))}
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
            onChange={(e) => onFormDataChange((prev: any) => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
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
                        onClick={() => onFormDataChange((prev: any) => ({ ...prev, codigo: suggestion }))}
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
        <SearchableModal
          items={unidadesMedida}
          value={formData.unidade_medida}
          onSelect={(item) => onFormDataChange((prev: any) => ({ ...prev, unidade_medida: item.value }))}
          getItemValue={(u) => u.value}
          getItemLabel={(u) => u.label}
          getItemSearchText={(u) => u.label}
          placeholder="Selecione a unidade"
          searchPlaceholder="Busque ou digite a unidade..."
          emptyMessage="Nenhuma unidade encontrada"
          title="Selecionar Unidade"
          emptyAction={{
            label: "Adicionar",
            isLoading: isAddingUnit,
            onClick: (val) => handleAddUnit(val),
            icon: <Plus className="h-4 w-4" />
          }}
          className="h-12 text-[16px]"
        />
      </div>
    </div>
  );
}
