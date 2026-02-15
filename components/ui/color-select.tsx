"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export const colors = [
  { name: "Slate", value: "bg-slate-500", text: "text-white" },
  { name: "Red", value: "bg-red-500", text: "text-white" },
  { name: "Orange", value: "bg-orange-500", text: "text-white" },
  { name: "Amber", value: "bg-amber-500", text: "text-white" },
  { name: "Yellow", value: "bg-yellow-500", text: "text-black" },
  { name: "Lime", value: "bg-lime-500", text: "text-black" },
  { name: "Green", value: "bg-green-500", text: "text-white" },
  { name: "Emerald", value: "bg-emerald-500", text: "text-white" },
  { name: "Teal", value: "bg-teal-500", text: "text-white" },
  { name: "Cyan", value: "bg-cyan-500", text: "text-black" },
  { name: "Sky", value: "bg-sky-500", text: "text-black" },
  { name: "Blue", value: "bg-blue-500", text: "text-white" },
  { name: "Indigo", value: "bg-indigo-500", text: "text-white" },
  { name: "Violet", value: "bg-violet-500", text: "text-white" },
  { name: "Purple", value: "bg-purple-500", text: "text-white" },
  { name: "Fuchsia", value: "bg-fuchsia-500", text: "text-white" },
  { name: "Pink", value: "bg-pink-500", text: "text-white" },
  { name: "Rose", value: "bg-rose-500", text: "text-white" },
]

interface ColorSelectProps {
  value?: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
}

export function ColorSelect({
  value,
  onChange,
  className,
  placeholder = "Select color"
}: ColorSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedColor = colors.find((c) => c.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between px-3 font-normal transition-all hover:bg-muted/50",
            className
          )}
        >
          <div className="flex items-center gap-2">
            {selectedColor ? (
              <div className={cn("h-4 w-4 rounded-full shadow-sm ring-1 ring-black/5", selectedColor.value)} />
            ) : (
              <div className="h-4 w-4 rounded-full bg-muted border border-border" />
            )}
            <span className={cn("truncate text-sm", !selectedColor && "text-muted-foreground")}>
              {selectedColor ? selectedColor.name : placeholder}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="grid grid-cols-5 gap-2">
          {colors.map((color) => (
            <button
              key={color.value}
              onClick={() => {
                onChange(color.value)
                setOpen(false)
              }}
              className={cn(
                "group relative flex h-9 w-9 items-center justify-center rounded-lg border border-transparent transition-all hover:scale-110 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2",
                color.value
              )}
              title={color.name}
            >
              <span className="sr-only">{color.name}</span>
              {value === color.value && (
                <Check className={cn("h-4 w-4 drop-shadow-sm", color.text)} />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
