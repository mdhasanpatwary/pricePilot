# PricePilot Component Documentation

This document provides comprehensive documentation for all shadcn/ui components used in the PricePilot application, including usage patterns, interfaces, and examples.

## Table of Contents

- [Overview](#overview)
- [Core shadcn/ui Components](#core-shadcnui-components)
- [Custom Extended Components](#custom-extended-components)
- [Component Composition Patterns](#component-composition-patterns)
- [TypeScript Integration](#typescript-integration)
- [Styling Guidelines](#styling-guidelines)
- [Usage Examples](#usage-examples)

## Overview

PricePilot uses shadcn/ui as the foundation for all UI components. This provides:

- **Consistent Design System**: All components follow the same visual patterns
- **Type Safety**: Full TypeScript integration with proper prop validation
- **Accessibility**: Built-in WCAG compliance and keyboard navigation
- **Customization**: Extensible components that can be customized while maintaining consistency
- **Performance**: Optimized components with minimal bundle impact

## Core shadcn/ui Components

### Form Components

#### Button
**Location**: `components/ui/button.tsx`
**Usage**: Primary action elements, form submissions, navigation

```typescript
interface ButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
  asChild?: boolean
}
```

**Examples**:
```tsx
<Button variant="default" size="lg">Primary Action</Button>
<Button variant="outline" size="sm">Secondary Action</Button>
<Button variant="ghost" size="icon"><Search className="w-4 h-4" /></Button>
```

#### Input
**Location**: `components/ui/input.tsx`
**Usage**: Text input fields, search boxes, form data entry

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  type?: string
}
```

#### Form
**Location**: `components/ui/form.tsx`
**Usage**: Form validation and structure with React Hook Form integration

```typescript
interface FormFieldProps {
  control: Control<any>
  name: string
  render: ({ field }) => React.ReactElement
}
```

#### Select
**Location**: `components/ui/select.tsx`
**Usage**: Dropdown selections, filters, option picking

```typescript
interface SelectProps {
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  disabled?: boolean
}
```

#### Checkbox
**Location**: `components/ui/checkbox.tsx`
**Usage**: Boolean selections, multi-select options

#### RadioGroup
**Location**: `components/ui/radio-group.tsx`
**Usage**: Single selection from multiple options

#### Switch
**Location**: `components/ui/switch.tsx`
**Usage**: Toggle controls, settings, feature flags

#### Textarea
**Location**: `components/ui/textarea.tsx`
**Usage**: Multi-line text input, descriptions, comments

### Display Components

#### Card
**Location**: `components/ui/card.tsx`
**Usage**: Content containers, information panels, dashboard widgets

```typescript
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

// Sub-components
CardHeader, CardContent, CardFooter, CardTitle, CardDescription
```

#### Badge
**Location**: `components/ui/badge.tsx`
**Usage**: Status indicators, labels, counts, tags

```typescript
interface BadgeProps {
  variant?: "default" | "secondary" | "destructive" | "outline"
}
```

#### Table
**Location**: `components/ui/table.tsx`
**Usage**: Data display, product listings, admin panels

```typescript
// Sub-components
Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption
```

#### Avatar
**Location**: `components/ui/avatar.tsx`
**Usage**: User profile images, team member displays

```typescript
// Sub-components
Avatar, AvatarImage, AvatarFallback
```

#### Progress
**Location**: `components/ui/progress.tsx`
**Usage**: Loading indicators, completion status, sync progress

#### Skeleton
**Location**: `components/ui/skeleton.tsx`
**Usage**: Loading states, content placeholders

### Navigation Components

#### Tabs
**Location**: `components/ui/tabs.tsx`
**Usage**: Content organization, settings panels, multi-view interfaces

```typescript
interface TabsProps {
  value?: string
  onValueChange?: (value: string) => void
  orientation?: "horizontal" | "vertical"
}

// Sub-components
Tabs, TabsList, TabsTrigger, TabsContent
```

#### DropdownMenu
**Location**: `components/ui/dropdown-menu.tsx`
**Usage**: Context menus, action menus, user menus

```typescript
// Sub-components
DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, 
DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel
```

### Overlay Components

#### Dialog
**Location**: `components/ui/dialog.tsx`
**Usage**: Modal dialogs, confirmations, forms

```typescript
interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// Sub-components
Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription
```

#### Sheet
**Location**: `components/ui/sheet.tsx`
**Usage**: Drawers, sidebars, slide-out panels

```typescript
interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

// Sub-components
Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription
```

#### Popover
**Location**: `components/ui/popover.tsx`
**Usage**: Tooltips, dropdown content, contextual information

### Utility Components

#### Separator
**Location**: `components/ui/separator.tsx`
**Usage**: Visual separation, content dividers

#### ScrollArea
**Location**: `components/ui/scroll-area.tsx`
**Usage**: Scrollable content areas, long lists

#### Label
**Location**: `components/ui/label.tsx`
**Usage**: Form field labels, accessibility

## Custom Extended Components

### FilterButton
**Location**: `components/ui/filter-button.tsx`
**Purpose**: Standardized filter controls with status indicators

```typescript
interface FilterButtonProps extends Omit<ButtonProps, "onClick"> {
  segment: string
  label: string
  count?: number
  status?: "RED" | "GREEN" | "NEUTRAL" | "COMP_OOS" | "NOT_FOUND" | "ALL"
  isActive: boolean
  onClick: (segment: string) => void
  showDot?: boolean
}
```

**Usage**:
```tsx
<FilterButton
  segment="active"
  label="Active Products"
  count={42}
  status="GREEN"
  isActive={activeFilter === "active"}
  onClick={handleFilterChange}
/>
```

### SearchInput
**Location**: `components/ui/search-input.tsx`
**Purpose**: Enhanced search functionality with suggestions and result counts

```typescript
interface SearchInputProps extends Omit<InputProps, "onChange" | "value"> {
  value?: string
  onValueChange?: (value: string) => void
  onSearch?: (query: string) => void
  onClear?: () => void
  isLoading?: boolean
  showClearButton?: boolean
  suggestions?: string[]
  onSuggestionSelect?: (suggestion: string) => void
  resultCount?: number
}
```

**Usage**:
```tsx
<SearchInput
  value={searchQuery}
  onValueChange={setSearchQuery}
  onSearch={handleSearch}
  suggestions={searchSuggestions}
  resultCount={searchResults.length}
  isLoading={isSearching}
/>
```

### StatusIndicator
**Location**: `components/ui/status-indicator.tsx`
**Purpose**: Consistent status displays using Badge variants

```typescript
interface StatusIndicatorProps {
  status: string
  label?: string
  icon?: React.ReactNode
  size?: "sm" | "default" | "lg"
  variant?: BadgeVariant
}
```

**Specialized Components**:
- `PriceStatus`: For price comparison statuses
- `ConnectionStatus`: For integration connection states
- `ActionStatus`: For user action results

**Usage**:
```tsx
<StatusIndicator status="GREEN" label="Optimal Price" />
<PriceStatus status="RED" showDot />
<ConnectionStatus status="ACTIVE" />
```

### Notification
**Location**: `components/ui/notification.tsx`
**Purpose**: User notifications and alerts using Card composition

```typescript
interface NotificationProps {
  title: string
  message: string
  type?: "info" | "success" | "warning" | "error"
  timestamp?: Date
  onDismiss?: () => void
  actions?: Array<{
    label: string
    onClick: () => void
    variant?: ButtonProps["variant"]
  }>
}
```

**Usage**:
```tsx
<Notification
  title="Sync Complete"
  message="Successfully updated 150 products"
  type="success"
  timestamp={new Date()}
  onDismiss={handleDismiss}
  actions={[
    { label: "View Details", onClick: handleViewDetails }
  ]}
/>
```

## Component Composition Patterns

### Extending Base Components

All custom components should extend shadcn/ui base components:

```typescript
// ✅ Good: Extends shadcn/ui Button
export const FilterButton = React.forwardRef<HTMLButtonElement, FilterButtonProps>(({
  // Custom props
  segment,
  label,
  status,
  // shadcn/ui Button props
  variant = "ghost",
  size = "sm",
  ...props
}, ref) => {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      {...props}
    >
      {/* Custom content */}
    </Button>
  );
});
```

### Composition Over Inheritance

Build complex components by composing multiple shadcn/ui components:

```typescript
// ✅ Good: Composes Card, Badge, Button
export function Notification({ title, message, type, actions }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <h4>{title}</h4>
          <Badge variant={getBadgeVariant(type)}>{type}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p>{message}</p>
        {actions && (
          <div className="flex gap-2">
            {actions.map(action => (
              <Button key={action.label} {...action} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### Forwarding Refs

Always forward refs for proper DOM access:

```typescript
export const CustomComponent = React.forwardRef<HTMLDivElement, CustomProps>(
  (props, ref) => {
    return <div ref={ref} {...props} />;
  }
);

CustomComponent.displayName = "CustomComponent";
```

## TypeScript Integration

### Prop Type Safety

Extend shadcn/ui component props for type safety:

```typescript
interface CustomButtonProps extends Omit<ButtonProps, "onClick"> {
  customProp: string
  onClick: (customData: string) => void
}
```

### Variant Typing

Use proper typing for component variants:

```typescript
type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

interface StatusProps {
  variant?: BadgeVariant
}
```

### Event Handler Typing

Maintain type safety for event handlers:

```typescript
interface FormProps {
  onSubmit: (data: FormData) => void
  onChange: (field: string, value: any) => void
}
```

## Styling Guidelines

### CSS Variable Usage

Use CSS variables for consistent theming:

```css
.custom-component {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
}
```

### Variant Implementation

Follow shadcn/ui variant patterns:

```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### Responsive Design

Use Tailwind responsive prefixes consistently:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid */}
</div>
```

## Usage Examples

### Form Implementation

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
});

function MyForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

### Table Implementation

```tsx
function ProductTable({ products }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell>{product.name}</TableCell>
            <TableCell>${product.price}</TableCell>
            <TableCell>
              <StatusIndicator status={product.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### Dialog Implementation

```tsx
function EditProductDialog({ product, open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update product information
          </DialogDescription>
        </DialogHeader>
        {/* Form content */}
      </DialogContent>
    </Dialog>
  );
}
```

### Sheet Implementation

```tsx
function ProductDetailSheet({ product, open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{product.name}</SheetTitle>
          <SheetDescription>
            Product details and analytics
          </SheetDescription>
        </SheetHeader>
        {/* Product details */}
      </SheetContent>
    </Sheet>
  );
}
```

## Best Practices

1. **Always extend shadcn/ui components** rather than creating from scratch
2. **Use composition** to build complex components from simple ones
3. **Maintain type safety** with proper TypeScript interfaces
4. **Follow naming conventions** with descriptive component names
5. **Document component props** with JSDoc comments
6. **Test component behavior** with comprehensive test coverage
7. **Use consistent styling** with shadcn/ui variants and CSS variables
8. **Implement accessibility** features like proper ARIA labels and keyboard navigation

## Migration Notes

When migrating from custom components to shadcn/ui:

1. **Preserve existing functionality** - ensure all event handlers and props work identically
2. **Maintain visual appearance** - use appropriate variants and custom styling
3. **Update TypeScript types** - extend shadcn/ui component interfaces
4. **Test thoroughly** - verify all interactions and edge cases
5. **Update documentation** - reflect new component usage patterns

This documentation should be updated as new components are added or existing ones are modified.