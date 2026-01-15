"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
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
    <button
      onClick={toggleTheme}
      className={cn(
        "group relative flex items-center justify-center w-10 h-10 rounded-xl",
        "bg-muted/40 backdrop-blur-md border border-border shadow-sm",
        "transition-all duration-300 hover:border-primary/40 hover:bg-muted/60",
        "active:scale-95 overflow-hidden"
      )}
      aria-label="Toggle theme"
    >
      <div className="relative w-5 h-5 transition-all duration-500 transform group-hover:rotate-12">
        <Sun className={cn(
          "w-5 h-5 absolute inset-0 transition-all duration-500 transform",
          resolvedTheme === "dark" ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100 text-primary"
        )} />
        <Moon className={cn(
          "w-5 h-5 absolute inset-0 transition-all duration-500 transform",
          resolvedTheme === "dark" ? "rotate-0 scale-100 opacity-100 text-primary" : "-rotate-90 scale-0 opacity-0"
        )} />
      </div>

      {/* Decorative background glow */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
    </button>
  );
}
