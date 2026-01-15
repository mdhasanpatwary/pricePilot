import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalloutProps {
  children: React.ReactNode;
  type?: "info" | "warning" | "error" | "success";
  title?: string;
}

const types = {
  info: {
    icon: Info,
    styles: "bg-blue-500/5 border-l-blue-500 text-foreground",
    iconStyles: "text-blue-500",
  },
  warning: {
    icon: AlertTriangle,
    styles: "bg-amber-500/5 border-l-amber-500 text-foreground",
    iconStyles: "text-amber-500",
  },
  error: {
    icon: AlertCircle,
    styles: "bg-red-500/5 border-l-red-500 text-foreground",
    iconStyles: "text-red-500",
  },
  success: {
    icon: CheckCircle2,
    styles: "bg-emerald-500/5 border-l-emerald-500 text-foreground",
    iconStyles: "text-emerald-500",
  },
};

export default function Callout({ children, type = "info", title }: CalloutProps) {
  const config = types[type];
  const Icon = config.icon;

  return (
    <div className={cn("my-8 flex items-start gap-4 rounded-md border border-border border-l-4 p-5", config.styles)}>
      <Icon className={cn("mt-1 w-4 h-4 shrink-0 opacity-80", config.iconStyles)} />
      <div className="space-y-1.5 flex-1 min-w-0">
        {title && <p className="text-sm font-bold tracking-tight text-foreground">{title}</p>}
        <div className="text-sm leading-relaxed text-foreground/80">
          {children}
        </div>
      </div>
    </div>
  );
}
