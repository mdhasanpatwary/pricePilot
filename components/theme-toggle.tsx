"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  if (!mounted) {
    return <div className="w-10 h-10" />;
  }

  const themes = [
    { name: "light", icon: Sun, label: "Switch to light theme" },
    { name: "dark", icon: Moon, label: "Switch to dark theme" },
    { name: "system", icon: Monitor, label: "Switch to system theme" },
  ];

  return (
    <div className="flex items-center bg-muted/40 backdrop-blur-md p-1.5 rounded-2xl border border-border transition-all hover:border-primary/20 shadow-sm">
      {themes.map(({ name, icon: Icon, label }) => (
        <button
          key={name}
          onClick={() => setTheme(name)}
          className={cn(
            "p-2.5 rounded-xl transition-all duration-400 relative group/btn overflow-hidden",
            theme === name
              ? "bg-background text-primary shadow-xl ring-1 ring-border"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
          title={label}
          aria-label={label}
        >
          <Icon className={cn(
            "w-4 h-4 transition-transform duration-500",
            theme === name ? "scale-110 rotate-0" : "group-hover/btn:scale-110 group-hover/btn:rotate-12"
          )} />
          {theme === name && (
            <div className="absolute inset-0 bg-primary/5 animate-pulse-soft pointer-events-none" />
          )}
        </button>
      ))}
    </div>
  );
}
