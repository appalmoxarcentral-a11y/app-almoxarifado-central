import * as React from 'react';
import { format } from 'date-fns/format';
import { parse } from 'date-fns/parse';
import { isValid } from 'date-fns/isValid';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Calendar as CalendarIcon } from 'lucide-react';

// Bypassing index files to avoid Vite pre-bundling issues

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface SmartDatePickerProps {
  value?: string; // Expects yyyy-MM-dd
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function SmartDatePicker({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
  id,
}: SmartDatePickerProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [isInvalid, setIsInvalid] = React.useState(false);

  // Update input value when prop value changes
  React.useEffect(() => {
    if (value) {
      try {
        const date = new Date(value + "T12:00:00"); // Avoid timezone issues
        if (isValid(date)) {
          setInputValue(format(date, "dd/MM/yyyy"));
          setIsInvalid(false);
        }
      } catch (e) {
        console.error("Error parsing date prop:", e);
      }
    } else if (inputValue.length !== 10) {
      setInputValue("");
      setIsInvalid(false);
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, ""); // Only digits
    
    // Auto-masking dd/mm/yyyy
    if (v.length > 2) v = v.substring(0, 2) + "/" + v.substring(2);
    if (v.length > 5) v = v.substring(0, 5) + "/" + v.substring(5, 9);
    
    setInputValue(v);

    // If we have a full date, try to update the parent
    if (v.length === 10) {
      const parsedDate = parse(v, "dd/MM/yyyy", new Date());
      if (isValid(parsedDate)) {
        onChange(format(parsedDate, "yyyy-MM-dd"));
        setIsInvalid(false);
      } else {
        // Se a data for inválida (ex: 31/06/2026), avisamos o pai
        // Passando "" garante que a validação de campo obrigatório/inválido dispare
        onChange("");
        setIsInvalid(true);
      }
    } else if (v.length === 0) {
      onChange("");
      setIsInvalid(false);
    } else {
      setIsInvalid(false);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setInputValue(format(date, "dd/MM/yyyy"));
      setIsInvalid(false);
    }
  };

  const selectedDate = value ? new Date(value + "T12:00:00") : undefined;

  return (
    <div className={cn("relative flex items-center", className)}>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={inputValue}
        onChange={handleInputChange}
        className={cn(
          "pr-10 h-12 text-[16px] rounded-xl border-border bg-background transition-colors",
          isInvalid && "border-destructive ring-1 ring-destructive focus-visible:ring-destructive"
        )}
        maxLength={10}
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-primary transition-colors"
          >
            <CalendarIcon className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleCalendarSelect}
            initialFocus
            locale={ptBR}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
