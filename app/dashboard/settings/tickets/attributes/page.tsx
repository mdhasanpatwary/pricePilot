"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ArrowLeft, MoreHorizontal, Settings2 } from "lucide-react";
import { ColorSelect, colors } from "@/components/ui/color-select";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface PriorityAttribute {
  id: string;
  name: string;
  level: number;
  color: string;
  description: string;
}

const initialPriorities: PriorityAttribute[] = [
  {
    id: "1",
    name: "Urgent",
    level: 1,
    color: "bg-red-500",
    description: "Requires immediate attention within 1 hour."
  },
  {
    id: "2",
    name: "High",
    level: 2,
    color: "bg-orange-500",
    description: "Critical issue affecting business operations."
  },
  {
    id: "3",
    name: "Medium",
    level: 3,
    color: "bg-blue-500",
    description: "Standard request or minor bug."
  },
  {
    id: "4",
    name: "Low",
    level: 4,
    color: "bg-slate-500",
    description: "Feature request or cosmetic improvement."
  },
];

export default function TicketAttributesPage() {
  const [priorities, setPriorities] = useState<PriorityAttribute[]>(initialPriorities);

  const handleColorChange = (id: string, newColor: string) => {
    setPriorities(priorities.map(p =>
      p.id === id ? { ...p, color: newColor } : p
    ));
  };

  const getTextColor = (bgClass: string) => {
    return colors.find(c => c.value === bgClass)?.text || "text-white";
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="p-2 hover:bg-muted rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Ticket Attributes</h2>
          <p className="text-muted-foreground text-sm">
            Customize ticket priorities, statuses, and categories.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-bold">Priority Levels</h3>
          </div>
          <Button size="sm" className="font-bold">
            <Plus className="mr-2 h-4 w-4" /> Add Priority
          </Button>
        </div>

        <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[100px] font-bold">Level</TableHead>
                <TableHead className="font-bold">Name</TableHead>
                <TableHead className="font-bold">Color Indicator</TableHead>
                <TableHead className="font-bold hidden md:table-cell">Preview</TableHead>
                <TableHead className="font-bold hidden lg:table-cell">Description</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {priorities.map((priority) => (
                <TableRow key={priority.id} className="group">
                  <TableCell className="font-mono font-medium text-muted-foreground">
                    P{priority.level}
                  </TableCell>
                  <TableCell className="font-bold">
                    {priority.name}
                  </TableCell>
                  <TableCell>
                    <div className="w-[180px]">
                        <ColorSelect
                            value={priority.color}
                            onChange={(color) => handleColorChange(priority.id, color)}
                        />
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge
                      className={cn(
                        "font-bold border-transparent px-3 py-1 text-[11px] shadow-sm transition-all hover:scale-105",
                        priority.color,
                        getTextColor(priority.color)
                      )}
                      variant="outline"
                    >
                      {priority.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-xs max-w-[250px] truncate">
                    {priority.description}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem>Edit details</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                          Delete priority
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
