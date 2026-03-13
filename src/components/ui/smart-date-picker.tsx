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

  // Update input value when prop value changes
  React.useEffect(() => {
    if (value) {
      try {
        const date = new Date(value + "T12:00:00"); // Avoid timezone issues
        if (isValid(date)) {
          setInputValue(format(date, "dd/MM/yyyy"));
        }
      } catch (e) {
        console.error("Error parsing date prop:", e);
      }
    } else {
      setInputValue("");
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
      }
    } else if (v.length === 0) {
      onChange("");
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setInputValue(format(date, "dd/MM/yyyy"));
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
        className="pr-10 h-12 text-[16px] rounded-xl border-border bg-background"
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
