import { useState } from "react";
import {
  X,
  Settings2,
  ShieldCheck,
  TrendingDown,
  Loader2,
  AlertTriangle,
  Lock,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const bulkUpdateSchema = z.object({
  logicType: z.enum(["FIXED", "PERCENTAGE"]),
  value: z.number().min(0, "Value must be positive"),
  minPrice: z.number().optional(),
});

type BulkUpdateFormValues = z.infer<typeof bulkUpdateSchema>;

interface BulkUpdateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onExecute: (logic: BulkUpdateFormValues) => Promise<void>;
}

export default function BulkUpdateDrawer({
  isOpen,
  onClose,
  selectedCount,
  onExecute,
}: BulkUpdateDrawerProps) {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<BulkUpdateFormValues>({
    resolver: zodResolver(bulkUpdateSchema),
    defaultValues: {
      logicType: "FIXED",
      value: 0.5,
    },
  });

  const logicType = useWatch({ control, name: "logicType" }) || "FIXED";
  const value = useWatch({ control, name: "value" }) || 0;

  const onSubmit = async (data: BulkUpdateFormValues) => {
    setLoading(true);
    await onExecute(data);
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-md z-100 animate-in fade-in duration-500"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-full max-w-xl bg-card border-l border-border z-110 shadow-[0px_0px_100px_rgba(0,0,0,0.5)] animate-in slide-in-from-right duration-500 flex flex-col overflow-hidden">
        {/* Glow Decor */}
        <div className="absolute -top-25 -right-25 w-100 h-100 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-25 -left-25 w-100 h-100 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="p-10 border-b border-border flex items-center justify-between relative z-10 bg-background/30 backdrop-blur-xl">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/20 glow">
              <Settings2 className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="space-y-0.5">
              <h2 className="text-2xl font-black tracking-tight">
                Execution Engine
              </h2>
              <div className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                Queue: {selectedCount} Strategic Targets
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-muted rounded-full transition-all text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form
          id="bulk-update-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto p-10 space-y-12 relative z-10"
        >
          <div className="space-y-8">
            <div className="space-y-6">
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] ml-1">
                Strategy Selection
              </p>
              <div className="grid grid-cols-2 gap-6">
                <button
                  type="button"
                  onClick={() =>
                    setValue("logicType", "FIXED", { shouldValidate: true })
                  }
                  className={cn(
                    "p-6 border-2 rounded-4xl flex flex-col gap-4 transition-all text-left relative overflow-hidden group/opt",
                    logicType === "FIXED"
                      ? "border-primary bg-primary/5 shadow-2xl shadow-primary/10"
                      : "border-border hover:border-primary/20 hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm",
                      logicType === "FIXED"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover/opt:text-primary",
                    )}
                  >
                    <TrendingDown className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-black text-lg tracking-tight">
                      Static Dip
                    </span>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase leading-relaxed opacity-60">
                      Fixed amount reduction for aggressive undercut.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setValue("logicType", "PERCENTAGE", {
                      shouldValidate: true,
                    })
                  }
                  className={cn(
                    "p-6 border-2 rounded-4xl flex flex-col gap-4 transition-all text-left relative overflow-hidden group/opt",
                    logicType === "PERCENTAGE"
                      ? "border-primary bg-primary/5 shadow-2xl shadow-primary/10"
                      : "border-border hover:border-primary/20 hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 shadow-sm",
                      logicType === "PERCENTAGE"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover/opt:text-primary",
                    )}
                  >
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-black text-lg tracking-tight">
                      Index Scaler
                    </span>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase leading-relaxed opacity-60">
                      Controlled percentage gap to maintain margin health.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] ml-1">
                    {logicType === "FIXED"
                      ? "Reduction Value ($)"
                      : "Spread Intensity (%)"}
                  </Label>
                  <div className="relative group">
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-2xl text-muted-foreground group-focus-within:text-primary transition-colors">
                      {logicType === "FIXED" ? "$" : "%"}
                    </div>
                    <Input
                      {...register("value", { valueAsNumber: true })}
                      type="number"
                      step="0.01"
                      className={cn(
                        "w-full bg-muted/30 border border-border rounded-3xl py-7 pl-14 pr-8 outline-none focus:border-primary/50 focus:ring-8 focus:ring-primary/5 transition-all font-black text-4xl tracking-tighter",
                        errors.value &&
                          "border-destructive focus:ring-destructive/5",
                      )}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.value && (
                    <p className="text-xs text-destructive font-bold ml-1">
                      {errors.value.message}
                    </p>
                  )}
                </div>
              </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between ml-1">
                    <Label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                      Margin Lockdown
                    </Label>
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-warning/10 border border-warning/20 rounded-full">
                      <Lock className="w-2.5 h-2.5 text-warning" />
                      <span className="text-[8px] text-warning font-black uppercase tracking-widest">
                        Safety Valve
                      </span>
                    </div>
                  </div>
                <div className="relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-xl text-muted-foreground group-focus-within:text-warning transition-colors">
                    $
                  </div>
                  <Input
                    {...register("minPrice", { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    className={cn(
                      "w-full bg-muted/30 border border-border rounded-3xl py-6 pl-14 pr-8 outline-none focus:border-warning/30 focus:ring-8 focus:ring-warning/5 transition-all font-black text-2xl tracking-tight placeholder:text-muted-foreground/20",
                      errors.minPrice &&
                        "border-destructive focus:ring-destructive/5",
                    )}
                    placeholder="Global Min Price"
                  />
                </div>
                {errors.minPrice && (
                  <p className="text-xs text-destructive font-bold ml-1">
                    {errors.minPrice.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/10 rounded-4xl p-8 space-y-4 relative overflow-hidden group/alert">
            <div className="absolute -top-12.5 -right-12.5 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover/alert:scale-150 transition-transform duration-700" />
            <div className="flex items-center gap-3 text-primary">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">
                Execution Summary
              </span>
            </div>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              You are authorizing{" "}
              <span className="text-foreground font-black">
                instant deployment
              </span>{" "}
              of price updates to your synchronized storefront. This action will
              undercut{" "}
              <span className="text-foreground font-black">
                {selectedCount} rival positions
              </span>{" "}
              with a{" "}
              {logicType === "FIXED" ? "fixed drop" : "percentage spread"} of
              <span className="text-primary font-black">
                {" "}
                {logicType === "FIXED" ? `$${value}` : `${value}%`}
              </span>
            </p>
          </div>
        </form>

        <div className="p-10 border-t border-border bg-card/60 backdrop-blur-3xl relative z-10">
          <Button
            type="submit"
            form="bulk-update-form"
            disabled={loading}
            className="w-full premium-gradient text-primary-foreground font-black py-7 rounded-[2.5rem] transition-all shadow-2xl shadow-primary/30 flex items-center justify-center gap-4 group disabled:opacity-50 active:scale-[0.98] text-xl glow"
          >
            {loading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                Confirm Execution
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center transition-transform group-hover:translate-x-2">
                  <ChevronRight className="w-6 h-6" />
                </div>
              </>
            )}
          </Button>
          <p className="text-[10px] text-center text-muted-foreground font-black uppercase tracking-[0.3em] mt-6 opacity-40">
            Auth req: administrator.sync_protocol_v2
          </p>
        </div>
      </div>
    </>
  );
}
