/**
 * SearchInput component extending shadcn/ui Input with search functionality
 * Demonstrates proper composition by building upon existing Input component
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input, InputProps } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X, Loader2 } from "lucide-react";

export interface SearchInputProps extends Omit<InputProps, "onChange" | "value"> {
    value?: string;
    onValueChange?: (value: string) => void;
    onSearch?: (query: string) => void;
    onClear?: () => void;
    isLoading?: boolean;
    showClearButton?: boolean;
    suggestions?: string[];
    onSuggestionSelect?: (suggestion: string) => void;
    resultCount?: number;
}

/**
 * SearchInput extends shadcn/ui Input with enhanced search functionality
 * Follows composition patterns while adding search-specific features
 */
export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    ({
        value = "",
        onValueChange,
        onSearch,
        onClear,
        isLoading = false,
        showClearButton = true,
        suggestions = [],
        onSuggestionSelect,
        resultCount,
        className,
        placeholder = "Search...",
        ...props
    }, ref) => {
        const [internalValue, setInternalValue] = React.useState(value);
        const [showSuggestions, setShowSuggestions] = React.useState(false);
        const inputRef = React.useRef<HTMLInputElement>(null);

        // Use forwarded ref or internal ref
        const resolvedRef = ref || inputRef;

        React.useEffect(() => {
            setInternalValue(value);
        }, [value]);

        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const newValue = e.target.value;
            setInternalValue(newValue);
            onValueChange?.(newValue);
            setShowSuggestions(newValue.length > 0 && suggestions.length > 0);
        };

        const handleSearch = () => {
            onSearch?.(internalValue);
            setShowSuggestions(false);
        };

        const handleClear = () => {
            setInternalValue("");
            onValueChange?.("");
            onClear?.();
            setShowSuggestions(false);
            if (resolvedRef && "current" in resolvedRef && resolvedRef.current) {
                resolvedRef.current.focus();
            }
        };

        const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleSearch();
            }
            if (e.key === "Escape") {
                setShowSuggestions(false);
            }
        };

        const handleSuggestionClick = (suggestion: string) => {
            setInternalValue(suggestion);
            onValueChange?.(suggestion);
            onSuggestionSelect?.(suggestion);
            setShowSuggestions(false);
            onSearch?.(suggestion);
        };

        return (
            <div className="relative">
                <div className="relative flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Search className="w-4 h-4" />
                        )}
                    </div>

                    <Input
                        ref={resolvedRef}
                        value={internalValue}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setShowSuggestions(internalValue.length > 0 && suggestions.length > 0)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        placeholder={placeholder}
                        className={cn("pl-10 pr-20", className)}
                        {...props}
                    />

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {resultCount !== undefined && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                                {resultCount}
                            </Badge>
                        )}

                        {showClearButton && internalValue && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleClear}
                                className="p-1 h-auto hover:bg-muted rounded"
                                aria-label="Clear search"
                            >
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        )}

                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleSearch}
                            disabled={isLoading}
                            className="p-1 h-auto hover:bg-muted rounded"
                            aria-label="Search"
                        >
                            <Search className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md z-50 max-h-60 overflow-y-auto">
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => handleSuggestionClick(suggestion)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2"
                            >
                                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                                {suggestion}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }
);

SearchInput.displayName = "SearchInput";

/**
 * SearchBar component that combines SearchInput with additional controls
 * Demonstrates composition by building upon SearchInput
 */
export interface SearchBarProps extends SearchInputProps {
    filters?: Array<{
        label: string;
        value: string;
        active: boolean;
        onClick: () => void;
    }>;
    sortOptions?: Array<{
        label: string;
        value: string;
        active: boolean;
        onClick: () => void;
    }>;
}

export function SearchBar({
    filters = [],
    sortOptions = [],
    ...searchProps
}: SearchBarProps) {
    return (
        <div className="space-y-4">
            <SearchInput {...searchProps} />

            {(filters.length > 0 || sortOptions.length > 0) && (
                <div className="flex items-center gap-4 flex-wrap">
                    {filters.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">Filters:</span>
                            {filters.map((filter) => (
                                <Button
                                    key={filter.value}
                                    variant={filter.active ? "default" : "outline"}
                                    size="sm"
                                    onClick={filter.onClick}
                                    className="text-xs"
                                >
                                    {filter.label}
                                </Button>
                            ))}
                        </div>
                    )}

                    {sortOptions.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">Sort:</span>
                            {sortOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={option.active ? "default" : "ghost"}
                                    size="sm"
                                    onClick={option.onClick}
                                    className="text-xs"
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}