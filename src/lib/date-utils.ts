
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

/**
 * Formata uma data vinda do banco de dados (string ISO ou data pura) 
 * garantindo que não haja deslocamento de fuso horário para exibições de calendário.
 */
export function formatarData(dateStr: string | null | undefined, formatStr: string = 'dd/MM/yyyy') {
  if (!dateStr) return '';
  
  try {
    // Extrai apenas a parte da data (YYYY-MM-DD)
    const datePart = dateStr.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    
    // Cria um objeto Date usando componentes numéricos (sempre interpretado como local)
    // Usamos meio-dia (12) para evitar qualquer chance de mudança de dia por fuso
    const normalizedDate = new Date(year, month - 1, day, 12, 0, 0);
    
    return format(normalizedDate, formatStr, { locale: ptBR });
  } catch (e) {
    console.error('Erro ao formatar data:', dateStr, e);
    return dateStr;
  }
}

/**
 * Formata um timestamp (ISO com fuso) para exibição local.
 */
export function formatarDataHora(timestamp: string | null | undefined, formatStr: string = 'dd/MM/yyyy HH:mm') {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    
    return format(date, formatStr, { locale: ptBR });
  } catch (e) {
    return timestamp;
  }
}
