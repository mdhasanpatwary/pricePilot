"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";

export interface ThemeToggleProps extends Omit<ButtonProps, "onClick"> {
  // Additional props can be added here if needed
}

/**
 * ThemeToggle extends shadcn/ui Button with theme switching functionality
 * Follows shadcn/ui composition patterns while maintaining existing behavior
 */
export const ThemeToggle = React.forwardRef<HTMLButtonElement, ThemeToggleProps>(({
  className,
  variant = "ghost",
  size = "icon",
  ...props
}, ref) => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return <div className="w-10 h-10" />;
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  return (
    <Button
      ref={ref}
      onClick={toggleTheme}
      variant={variant}
      size={size}
      className={cn(
        "group relative overflow-hidden",
        "bg-muted/40 backdrop-blur-md border border-border shadow-sm",
        "transition-all duration-300 hover:border-primary/40 hover:bg-muted/60",
        "active:scale-95",
        className
      )}
      aria-label="Toggle theme"
      {...props}
    >
      <div className="relative w-5 h-5 transition-all duration-500 transform group-hover:rotate-12">
        <Sun
          className={cn(
            "w-5 h-5 absolute inset-0 transition-all duration-500 transform",
            resolvedTheme === "dark"
              ? "rotate-90 scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100 text-primary",
          )}
        />
        <Moon
          className={cn(
            "w-5 h-5 absolute inset-0 transition-all duration-500 transform",
            resolvedTheme === "dark"
              ? "rotate-0 scale-100 opacity-100 text-primary"
              : "-rotate-90 scale-0 opacity-0",
          )}
        />
      </div>

      {/* Decorative background glow */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </Button>
  );
});

ThemeToggle.displayName = "ThemeToggle";
