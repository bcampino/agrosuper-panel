'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ChevronDown, X } from 'lucide-react'

export interface CheckboxOption {
  value: string
  label: string
}

interface FilterCheckboxGroupProps {
  label: string
  options: CheckboxOption[]
  selected: string[] // CSV-split values from URL
  onChange: (values: string[]) => void
  width?: string
}

export function FilterCheckboxGroup({
  label,
  options,
  selected,
  onChange,
  width = 'w-[220px]',
}: FilterCheckboxGroupProps) {
  const [open, setOpen] = useState(false)

  const toggleOption = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value]
    onChange(newSelected)
  }

  const toggleAll = (checked: boolean) => {
    onChange(checked ? options.map(o => o.value) : [])
  }

  const isAllChecked = selected.length === options.length && options.length > 0
  const isSomeChecked = selected.length > 0 && selected.length < options.length
  const displayLabel = selected.length > 0 ? `${selected.length} selec.` : 'Todos'

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
        {label}
      </span>
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={`${width} h-8 px-2 rounded-md border border-input bg-background text-sm flex items-center justify-between hover:bg-accent`}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="absolute top-9 left-0 z-20 min-w-[220px] rounded-md border bg-popover p-2 shadow-md">
            {/* Select all / Clear all */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b mb-2">
              <Checkbox
                checked={isAllChecked}
                indeterminate={isSomeChecked}
                onCheckedChange={(checked) => toggleAll(checked === true)}
              />
              <label className="text-sm font-medium cursor-pointer flex-1">
                {isAllChecked ? 'Deseleccionar todo' : 'Seleccionar todo'}
              </label>
            </div>

            {/* Options */}
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {options.map((option) => (
                <div key={option.value} className="flex items-center gap-2 px-2 py-1">
                  <Checkbox
                    checked={selected.includes(option.value)}
                    onCheckedChange={() => toggleOption(option.value)}
                  />
                  <label className="text-sm cursor-pointer flex-1">{option.label}</label>
                </div>
              ))}
            </div>

            {/* Clear button */}
            {selected.length > 0 && (
              <div className="border-t pt-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange([])
                    setOpen(false)
                  }}
                  className="w-full h-7 text-xs gap-1"
                >
                  <X className="h-3 w-3" />
                  Limpiar
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
