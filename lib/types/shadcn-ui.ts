/**
 * Enhanced TypeScript interfaces for shadcn/ui components
 * Provides type safety for component props, variants, and event handlers
 */

import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";

// Base component props that extend shadcn/ui components
export interface BaseComponentProps {
    className?: string;
    children?: React.ReactNode;
}

// Enhanced Button component props with strict variant typing
export interface EnhancedButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
    loading?: boolean;
    icon?: React.ReactNode;
}

// Enhanced Table component props with type-safe data handling
export interface EnhancedTableProps<T = any> extends BaseComponentProps {
    data: T[];
    columns: TableColumn<T>[];
    onRowClick?: (row: T, event: React.MouseEvent) => void;
    onRowSelect?: (selectedRows: T[]) => void;
    selectedRows?: string[];
    loading?: boolean;
    emptyMessage?: string;
    className?: string;
}

export interface TableColumn<T = any> {
    key: keyof T | string;
    header: string;
    accessor?: (row: T) => React.ReactNode;
    sortable?: boolean;
    width?: string | number;
    align?: "left" | "center" | "right";
    className?: string;
}

// Enhanced Form component props with Zod integration
export interface EnhancedFormProps<T = any> extends BaseComponentProps {
    onSubmit: (data: T) => void | Promise<void>;
    defaultValues?: Partial<T>;
    schema?: any; // Zod schema
    loading?: boolean;
    resetOnSubmit?: boolean;
}

// Enhanced Sheet (Drawer) component props
export interface EnhancedSheetProps
    extends React.ComponentPropsWithoutRef<"div"> {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title?: string;
    description?: string;
    showCloseButton?: boolean;
    side?: SheetSide;
}

// Enhanced Select component props with type-safe options
export interface EnhancedSelectProps<T = string> extends BaseComponentProps {
    value?: T;
    onValueChange?: (value: T) => void;
    options: SelectOption<T>[];
    placeholder?: string;
    disabled?: boolean;
    loading?: boolean;
    searchable?: boolean;
    multiple?: boolean;
}

export interface SelectOption<T = string> {
    value: T;
    label: string;
    disabled?: boolean;
    icon?: React.ReactNode;
    description?: string;
}

// Enhanced DropdownMenu component props
export interface EnhancedDropdownMenuProps extends BaseComponentProps {
    trigger: React.ReactNode;
    items: DropdownMenuItem[];
    align?: "start" | "center" | "end";
    side?: "top" | "right" | "bottom" | "left";
    disabled?: boolean;
}

export interface DropdownMenuItem {
    key: string;
    label: string;
    icon?: React.ReactNode;
    shortcut?: string;
    disabled?: boolean;
    destructive?: boolean;
    onClick?: () => void;
    type?: "item" | "separator" | "label" | "checkbox" | "radio";
    checked?: boolean;
}

// Enhanced Badge component props with strict variant typing
export interface EnhancedBadgeProps extends BaseComponentProps {
    variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
    size?: "sm" | "default" | "lg";
    icon?: React.ReactNode;
}

// Enhanced Input component props with validation states
export interface EnhancedInputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helperText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    loading?: boolean;
    variant?: "default" | "error" | "success";
}

// Enhanced Card component props
export interface EnhancedCardProps extends BaseComponentProps {
    title?: string;
    description?: string;
    footer?: React.ReactNode;
    loading?: boolean;
    interactive?: boolean;
    variant?: "default" | "outline" | "filled";
}

// Event handler types for type-safe event handling
export type TableRowClickHandler<T = any> = (row: T, event: React.MouseEvent<HTMLTableRowElement>) => void;
export type TableRowSelectHandler<T = any> = (selectedRows: T[]) => void;
export type FormSubmitHandler<T = any> = (data: T, event?: React.FormEvent) => void | Promise<void>;
export type ButtonClickHandler = (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
export type SelectChangeHandler<T = any> = (value: T) => void;
export type InputChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => void;

// Component variant types for strict typing
export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
export type ButtonSize = "default" | "sm" | "lg" | "icon";
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
export type SheetSide = "top" | "right" | "bottom" | "left";
export type InputVariant = "default" | "error" | "success";

// Utility types for component composition
export type ComponentWithVariants<T, V> = T & {
    variant?: V;
};

export type ComponentWithSize<T, S> = T & {
    size?: S;
};

// Type guards for runtime type checking
export const isValidButtonVariant = (variant: string): variant is ButtonVariant => {
    return ["default", "destructive", "outline", "secondary", "ghost", "link"].includes(variant);
};

export const isValidBadgeVariant = (variant: string): variant is BadgeVariant => {
    return ["default", "secondary", "destructive", "outline", "success", "warning"].includes(variant);
};

export const isValidSheetSide = (side: string): side is SheetSide => {
    return ["top", "right", "bottom", "left"].includes(side);
};

// Component ref types for proper ref forwarding
export type ButtonRef = React.ElementRef<"button">;
export type InputRef = React.ElementRef<"input">;
export type TableRef = React.ElementRef<"table">;
export type SheetRef = React.ElementRef<"div">;

// Composite component types for complex components
export interface CompositeTableProps<T = any> extends EnhancedTableProps<T> {
    pagination?: {
        page: number;
        pageSize: number;
        total: number;
        onPageChange: (page: number) => void;
        onPageSizeChange: (pageSize: number) => void;
    };
    sorting?: {
        column: keyof T | null;
        direction: "asc" | "desc" | null;
        onSort: (column: keyof T) => void;
    };
    filtering?: {
        filters: Record<string, any>;
        onFilterChange: (filters: Record<string, any>) => void;
    };
}

export interface CompositeFormProps<T = any> extends EnhancedFormProps<T> {
    fields: FormField<T>[];
    layout?: "vertical" | "horizontal" | "grid";
    submitButton?: {
        text: string;
        variant?: ButtonVariant;
        loading?: boolean;
    };
    resetButton?: {
        text: string;
        variant?: ButtonVariant;
    };
}

export interface FormField<T = any> {
    name: keyof T;
    label: string;
    type: "text" | "email" | "password" | "number" | "select" | "textarea" | "checkbox" | "radio";
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    options?: SelectOption[];
    validation?: any; // Zod schema for field
    helperText?: string;
    className?: string;
}