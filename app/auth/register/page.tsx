"use client";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  Sparkles,
  Building2,
  Eye,
  EyeOff,
} from "lucide-react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { PasswordStrengthIndicator } from "@/components/ui/password-strength-indicator";

const registerSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  email: z.string().email("Please enter a valid work email"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/,
      "Password must contain uppercase, lowercase, number, and special character"
    ),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (res.ok) {
        toast.success("Account created! Accessing dashboard...");

        // Auto-login after registration
        const loginResult = await signIn("credentials", {
          email: data.email,
          password: data.password,
          redirect: false,
        });

        if (loginResult?.error) {
          toast.error(
            "Account created, but automatic login failed. Please login manually.",
          );
          router.push("/auth/login");
        } else {
          router.push("/dashboard");
        }
      } else {
        toast.error(result.error || "Registration failed");
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex selection:bg-primary selection:text-white bg-background">
      {/* Left Decoration - Hidden on mobile */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden premium-gradient items-center justify-center p-20">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-[80px] animate-pulse-soft" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-white/5 rounded-full blur-[100px] animate-pulse-soft delay-700" />

        <div className="relative z-10 space-y-8 max-w-lg text-white">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            Strategic Pricing
          </div>
          <h2 className="text-6xl font-black leading-none tracking-tight">
            Win Every Price Battle.
          </h2>
          <p className="text-white/70 text-lg leading-relaxed font-light">
            Create your command center today. Join 500+ merchants who have
            captured more market share this week using PricePilot.
          </p>

          <div className="pt-10 flex items-center gap-12 border-t border-white/10">
            <div className="space-y-1">
              <p className="text-3xl font-black tracking-tight">14 Days</p>
              <p className="text-white/60 text-xs uppercase font-bold tracking-widest">
                Free Trial
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-black tracking-tight">Zero</p>
              <p className="text-white/60 text-xs uppercase font-bold tracking-widest">
                Credit Card
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Register Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 relative">
        <div className="absolute top-8 left-8 lg:hidden">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold tracking-tighter">
              PricePilot
            </span>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight">Sign Up.</h1>
            <p className="text-muted-foreground font-medium">
              Start your 14-day free trial now.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                        Company Name
                      </FormLabel>
                      <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            className="pl-12 pr-4"
                            placeholder="Acme Corp"
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-xs font-bold ml-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                        Work Email
                      </FormLabel>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            className="pl-12 pr-4"
                            placeholder="name@company.com"
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-xs font-bold ml-1" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                        Password
                      </FormLabel>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors z-10" />
                        <FormControl>
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            className="pl-12 pr-12"
                            placeholder="••••••••••••"
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors h-8 w-8"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <PasswordStrengthIndicator password={field.value} />
                      <FormMessage className="text-xs font-bold ml-1" />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full premium-gradient text-primary-foreground font-black text-lg py-5 rounded-2xl transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-primary/20 glow-hover"
              >
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="pt-8 space-y-4 border-t border-border text-center">
            <p className="text-sm text-muted-foreground font-medium">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="text-foreground hover:text-primary transition-colors font-bold border-b border-foreground hover:border-primary"
              >
                Login instead
              </Link>
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-loose">
              By signing up, you agree to our <br />
              <Link href="#" className="underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="#" className="underline">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
