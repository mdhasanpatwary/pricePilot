"use client";

import Link from "next/link";
import { ShieldCheck, ArrowRight, TrendingUp, Zap, BarChart3, Globe, Shield, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background selection:bg-primary selection:text-primary-foreground">
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow">
            <ShieldCheck className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold tracking-tighter">PricePilot</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-primary transition-colors">Workflows</a>
          <a href="#pricing" className="hover:text-primary transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Link href="/auth/login" className="text-sm font-semibold hover:text-primary transition-colors px-4 py-2">
            Login
          </Link>
          <Link href="/auth/register" className="premium-gradient px-6 py-2.5 rounded-full text-sm font-bold text-primary-foreground glow-hover">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-28 px-6 overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] from-primary/10 via-transparent to-transparent opacity-50" />
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] animate-pulse-soft" />
        <div className="absolute top-40 -left-60 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse-soft" />

        <div className="max-w-6xl mx-auto text-center space-y-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.2em] animate-bounce-subtle shadow-sm">
            <Zap className="w-3.5 h-3.5 fill-current" />
            V1.0 Experience is Live
          </div>

          <h1 className="text-7xl md:text-[9rem] font-black tracking-tight leading-[0.85] text-foreground">
            Win Every <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-500 to-accent animate-shimmer">Price Battle</span>
          </h1>

          <p className="max-w-3xl mx-auto text-xl md:text-2xl text-muted-foreground leading-relaxed font-medium">
            The ultimate pricing intelligence engine for modern e-commerce. Match competitors, automate undercuts, and protect your margins with surgical precision.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-10">
            <Link href="/auth/register" className="w-full sm:w-auto premium-gradient px-12 py-6 rounded-[2rem] text-xl font-black text-primary-foreground glow-hover flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-primary/20">
              Start Scaling Now
              <ArrowRight className="w-6 h-6" />
            </Link>
            <button className="w-full sm:w-auto bg-card/50 backdrop-blur-md border border-border px-12 py-6 rounded-[2rem] text-xl font-black hover:bg-muted transition-all active:scale-95">
              Watch Demo
            </button>
          </div>

          {/* Social Proof */}
          <div className="pt-24">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.4em] mb-12 opacity-70">Trusted by Global Brands</p>
            <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
               <span className="text-3xl font-black tracking-tighter italic hover:text-primary cursor-default">LUMINA</span>
               <span className="text-3xl font-black tracking-tighter italic hover:text-primary cursor-default">VENTURE</span>
               <span className="text-3xl font-black tracking-tight italic hover:text-primary cursor-default">ECOM-PRO</span>
               <span className="text-4xl font-black tracking-tighter italic hover:text-primary cursor-default">NEXTGEN</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-40 px-6 relative bg-muted/20">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
        <div className="max-w-6xl mx-auto space-y-24 relative z-10">
          <div className="text-center space-y-6">
            <h2 className="text-5xl md:text-6xl font-black tracking-tight">Everything you need to lead</h2>
            <p className="text-muted-foreground text-xl max-w-2xl mx-auto font-medium">Smarter tools for data-driven merchants who refuse to lose on price.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { icon: Globe, title: "Global Intelligence", desc: "Track competitors across any platform using our proprietary crawling engine." },
              { icon: Zap, title: "Instant Execution", desc: "Push price updates to OpenCart or Laravel stores in milliseconds." },
              { icon: Shield, title: "Margin Guard", desc: "Advanced safety valves ensure you never sell below cost by accident." },
              { icon: BarChart3, title: "Excel-Core Analytics", desc: "High-performance data grids with real-time status color coding." },
              { icon: CheckCircle2, title: "Smart Matching", desc: "AI-powered product matching via SKU, Brand, or Model detection." },
              { icon: TrendingUp, title: "Profit Maximizer", desc: "Dynamic logic to capture more profit during low-competition periods." },
            ].map((f, i) => (
              <div key={i} className="group bg-card border border-border p-10 rounded-[2.5rem] hover:border-primary/40 hover:bg-primary/[0.01] transition-all hover:-translate-y-3 shadow-xl shadow-black/[0.02] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
                <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-8 group-hover:bg-primary group-hover:text-primary-foreground group-hover:glow transition-all duration-500 text-primary">
                  <f.icon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black mb-4 tracking-tight">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-40 px-6">
        <div className="max-w-6xl mx-auto premium-gradient rounded-[4rem] p-16 md:p-32 text-center text-white glow relative overflow-hidden group shadow-3xl shadow-primary/20">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none" />
          <div className="absolute top-[-100px] left-[-100px] w-96 h-96 bg-white/10 rounded-full blur-[120px] animate-pulse-soft" />
          <div className="absolute bottom-[-100px] right-[-100px] w-96 h-96 bg-accent/20 rounded-full blur-[120px] animate-pulse-soft" />

          <div className="relative z-10 space-y-12">
            <h2 className="text-5xl md:text-8xl font-black tracking-tight leading-[0.9]">
              Ready to take control <br className="hidden md:block" /> of your market?
            </h2>
            <p className="text-white/80 max-w-2xl mx-auto text-xl md:text-2xl font-medium leading-relaxed">
              Join 500+ merchants who optimized their pricing this week. 14-day free trial. No credit card required.
            </p>
            <div className="pt-8">
              <Link href="/auth/register" className="inline-flex items-center gap-4 bg-background text-foreground px-14 py-7 rounded-[2rem] font-black text-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl hover:shadow-background/10">
                Get Early Access
                <ArrowRight className="w-8 h-8" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 px-6 border-t border-border bg-card/30">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12">
           <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center glow transition-transform hover:rotate-6">
              <ShieldCheck className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter leading-none">PricePilot</span>
              <span className="text-[8px] font-black uppercase text-muted-foreground tracking-[0.3em] mt-1">Intelligence SaaS</span>
            </div>
          </div>
          <p className="text-muted-foreground text-sm font-medium opacity-70 italic text-center md:text-left">© 2026 PricePilot Intelligence. <br className="md:hidden" /> Built by Antigravity for the modern winner.</p>
          <div className="flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
             <a href="#" className="hover:text-primary transition-colors">Privacy</a>
             <a href="#" className="hover:text-primary transition-colors">Terms</a>
             <a href="#" className="hover:text-primary transition-colors">Support</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
