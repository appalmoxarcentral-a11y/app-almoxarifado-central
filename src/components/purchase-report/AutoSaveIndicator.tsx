import React, { useEffect, useState } from 'react';
import { Cloud, CloudOff, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AutoSaveIndicatorProps {
  isAutoSaving: boolean;
  currentDraftId: string | null;
  hasChanges: boolean;
}

export function AutoSaveIndicator({ isAutoSaving, currentDraftId, hasChanges }: AutoSaveIndicatorProps) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  useEffect(() => {
    if (!isAutoSaving && currentDraftId) {
      setLastSaved(new Date());
    }
  }, [isAutoSaving, currentDraftId]);

  if (!currentDraftId) {
    return null;
  }

  if (isAutoSaving) {
    return (
      <Badge variant="secondary" className="text-xs">
        <Save className="h-3 w-3 mr-1 animate-pulse" />
        Salvando...
      </Badge>
    );
  }

  if (hasChanges) {
    return (
      <Badge variant="outline" className="text-xs border-orange-200 text-orange-700">
        <CloudOff className="h-3 w-3 mr-1" />
        Mudanças não salvas
      </Badge>
    );
  }

  if (lastSaved) {
    return (
      <Badge variant="outline" className="text-xs border-green-200 text-green-700">
        <Cloud className="h-3 w-3 mr-1" />
        Salvo automaticamente
      </Badge>
    );
  }

  return null;
}