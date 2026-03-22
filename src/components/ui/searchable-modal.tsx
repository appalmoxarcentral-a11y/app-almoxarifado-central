
import * as React from "react"
import { Check, Search, Plus, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

interface SearchableModalProps<T> {
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
  title?: string
  onSearchChange?: (value: string) => void
  emptyAction?: {
    label: string
    onClick: (searchValue: string) => void
    icon?: React.ReactNode
    isLoading?: boolean
  }
}

export function SearchableModal<T>({
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
  title = "Selecionar Item",
  onSearchChange,
  emptyAction,
}: SearchableModalProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const filteredItems = React.useMemo(() => {
    if (onSearchChange) return items // External search handles filtering
    if (!searchValue) return items
    const searchLower = searchValue.toLowerCase()
    return items.filter(item => 
      getItemSearchText(item).toLowerCase().includes(searchLower)
    )
  }, [items, searchValue, getItemSearchText, onSearchChange])

  const selectedItem = items.find(item => getItemValue(item) === value)

  const handleSelect = (item: T) => {
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
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
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-card border-border shadow-2xl rounded-t-none rounded-b-2xl sm:rounded-2xl top-0 sm:top-[50%] translate-y-0 sm:translate-y-[-50%] transition-all duration-300 border-t-0 sm:border-t">
        <DialogHeader className="p-3 sm:p-4 border-b border-border bg-muted/30">
          <DialogTitle className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
            <Search className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <Command className="bg-transparent" shouldFilter={false}>
          <div className="flex items-center border-b border-border/50 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
            <CommandInput
              placeholder={searchPlaceholder}
              value={searchValue}
              onValueChange={handleSearchValueChange}
              className="flex h-12 sm:h-14 w-full rounded-md bg-transparent py-2 sm:py-3 text-[16px] outline-none placeholder:text-muted-foreground/60"
              autoFocus
            />
            {searchValue && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full hover:bg-muted"
                onClick={() => handleSearchValueChange("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <CommandList className="max-h-[200px] sm:max-h-[300px] overflow-y-auto p-1 sm:p-2 custom-scrollbar">
            <CommandEmpty>
              <div className="py-6 sm:py-8 text-center px-4">
                <p className="text-muted-foreground font-medium mb-3 sm:mb-4 text-sm sm:text-base">{emptyMessage}</p>
                {emptyAction && searchValue && (
                  <Button
                    type="button"
                    className="w-full h-10 sm:h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm"
                    onClick={() => {
                      emptyAction.onClick(searchValue)
                      // Do NOT close modal if loading, mutation will handle it or keep it open for feedback
                      if (!emptyAction.isLoading) {
                        setOpen(false)
                        setSearchValue("")
                      }
                    }}
                    disabled={emptyAction.isLoading}
                  >
                    {emptyAction.isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      emptyAction.icon || <Plus className="h-4 w-4" />
                    )}
                    <span>{emptyAction.label} "{searchValue}"</span>
                  </Button>
                )}
              </div>
            </CommandEmpty>
            <CommandGroup>
              {filteredItems.map((item, index) => {
                const itemValue = getItemValue(item)
                const itemLabel = getItemLabel(item)
                const isSelected = value === itemValue

                return (
                  <CommandItem
                    key={`${itemValue}-${index}`}
                    value={itemValue}
                    onSelect={() => handleSelect(item)}
                    className={cn(
                      "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 mb-0.5 sm:mb-1 rounded-lg sm:rounded-xl cursor-pointer transition-all text-sm sm:text-base",
                      isSelected ? "bg-primary/10 text-primary font-bold border border-primary/20" : "hover:bg-muted/50"
                    )}
                  >
                    <div className={cn(
                      "flex items-center justify-center w-4 h-4 sm:w-5 sm:h-5 rounded-full border transition-all",
                      isSelected ? "border-primary bg-primary text-white" : "border-muted-foreground/30"
                    )}>
                      {isSelected && <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3" />}
                    </div>
                    <span className="flex-1 truncate">{itemLabel}</span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
