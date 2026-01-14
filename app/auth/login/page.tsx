"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, Mail, ArrowRight, Loader2, Sparkles } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
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
           <h2 className="text-6xl font-black leading-none tracking-tight">Scale your profit while you sleep.</h2>
           <p className="text-white/70 text-lg leading-relaxed font-light">
             Join thousands of modern merchants who are winning the market war with
             automated intelligence and real-time execution.
           </p>

           <div className="pt-10 flex items-center gap-12 border-t border-white/10">
              <div className="space-y-1">
                 <p className="text-3xl font-black tracking-tight">82%</p>
                 <p className="text-white/60 text-xs uppercase font-bold tracking-widest">Efficiency boost</p>
              </div>
              <div className="space-y-1">
                 <p className="text-3xl font-black tracking-tight">12X</p>
                 <p className="text-white/60 text-xs uppercase font-bold tracking-widest">Product velocity</p>
              </div>
           </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 md:p-12 relative">
        <div className="absolute top-8 left-8 lg:hidden">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold tracking-tighter">PricePilot</span>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight">Login.</h1>
            <p className="text-muted-foreground font-medium">Welcome back to your command center.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-2xl flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-muted/30 border border-border rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium placeholder:text-muted-foreground/30"
                    placeholder="name@company.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Password</label>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-muted/30 border border-border rounded-2xl py-4 pl-12 pr-4 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-medium placeholder:text-muted-foreground/30"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full premium-gradient text-white font-black text-lg py-5 rounded-2xl transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-primary/20 glow-hover"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  Enter Dashboard
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="pt-8 space-y-4 border-t border-border">
             <p className="text-center text-sm text-muted-foreground font-medium">
                Don&apos;t have access?{" "}
                <Link href="#" className="text-foreground hover:text-primary transition-colors font-bold border-b border-foreground hover:border-primary">
                  Contact Sales
                </Link>
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
