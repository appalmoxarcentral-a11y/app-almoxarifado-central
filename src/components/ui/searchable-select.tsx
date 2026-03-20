
import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface SearchableSelectProps<T> {
  items: T[]
  value?: string
  onSelect: (item: T) => void
  getItemValue: (item: T) => string
  getItemLabel: (item: T) => string
  getItemSearchText: (item: T) => string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  onSearchChange?: (value: string) => void
  emptyAction?: {
    label: string
    onClick: (searchValue: string) => void
    icon?: React.ReactNode
  }
}

export function SearchableSelect<T>({
  items,
  value,
  onSelect,
  getItemValue,
  getItemLabel,
  getItemSearchText,
  placeholder = "Selecione um item...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum item encontrado",
  disabled = false,
  className,
  onSearchChange,
  emptyAction,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const [lastSelectedItem, setLastSelectedItem] = React.useState<T | null>(null)

  // Atualizar o item selecionado persistente se encontrarmos ele na lista atual
  React.useEffect(() => {
    if (value) {
      const found = items.find(item => getItemValue(item) === value)
      if (found) {
        setLastSelectedItem(found)
      }
    } else {
      setLastSelectedItem(null)
    }
  }, [value, items, getItemValue])

  const filteredItems = React.useMemo(() => {
    if (onSearchChange) return items // Se tiver busca externa, não filtra localmente
    if (!searchValue) return items
    const searchLower = searchValue.toLowerCase()
    return items.filter(item => 
      getItemSearchText(item).toLowerCase().includes(searchLower)
    )
  }, [items, searchValue, getItemSearchText, onSearchChange])

  // Tenta achar o item na lista atual, senão usa o último selecionado persistido
  const selectedItem = items.find(item => getItemValue(item) === value) || lastSelectedItem

  const handleSelect = (item: T) => {
    setLastSelectedItem(item)
    onSelect(item)
    setOpen(false)
    setSearchValue("")
    if (onSearchChange) onSearchChange("")
  }

  const handleSearchValueChange = (val: string) => {
    setSearchValue(val)
    if (onSearchChange) {
      onSearchChange(val)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between min-h-[40px] h-auto text-left font-normal",
            !selectedItem && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {selectedItem ? getItemLabel(selectedItem) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={handleSearchValueChange}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-[16px] outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandList>
            <CommandEmpty>
              <div className="py-6 text-center text-sm">
                <p className="text-muted-foreground">{emptyMessage}</p>
                {emptyAction && searchValue && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-4 text-primary hover:text-primary hover:bg-primary/10 font-bold"
                    onClick={() => {
                      emptyAction.onClick(searchValue)
                      setOpen(false)
                      setSearchValue("")
                    }}
                  >
                    {emptyAction.icon}
                    <span className="ml-2">{emptyAction.label} "{searchValue}"</span>
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredItems.map((item, index) => {
                const itemValue = getItemValue(item)
                const itemLabel = getItemLabel(item)
                return (
                  <CommandItem
                    key={`${itemValue}-${index}`}
                    value={itemValue}
                    onSelect={() => handleSelect(item)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === itemValue ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="flex-1 truncate">{itemLabel}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
