import { HelpCircle, MessageCircle } from "lucide-react";
import Link from "next/link";

export default function FAQDocsPage() {
  const faqs = [
    {
      category: "General",
      questions: [
        {
          q: "What is PricePilot?",
          a: "PricePilot is an automated pricing and inventory engine that help e-commerce stores react to competitor price changes in real-time.",
        },
        {
          q: "How often are prices synced?",
          a: "Competitor prices are automatically monitored every 24 hours (daily at midnight UTC). This ensures comprehensive price monitoring while respecting rate limits and system resources. The sync schedule is configured in your dashboard settings.",
        },
      ],
    },
    {
      category: "Integrations",
      questions: [
        {
          q: "Do you support custom platforms?",
          a: "Yes. In addition to our native plugins for Shopify and Laravel, you can use our REST API to build custom integrations for any platform.",
        },
        {
          q: "Is the Laravel package free?",
          a: "The Laravel integration client is provided free of charge to all PricePilot users on standard and enterprise plans.",
        },
      ],
    },
    {
      category: "Security",
      questions: [
        {
          q: "How is my store data protected?",
          a: "All data is encrypted in transit via TLS 1.3 and at rest using AES-256. We use role-based access control and secure API tokens for all integrations.",
        },
      ],
    },
  ];

  return (
    <div className="space-y-12 animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground font-bold text-[11px] uppercase tracking-wider">
          <HelpCircle className="w-3.5 h-3.5" /> Support
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Frequently Asked Questions
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed max-w-2xl">
          Quick answers to the most common questions about the PricePilot engine and integrations.
        </p>
      </div>

      <div className="h-px bg-border/50" />

      {/* FAQ Sections */}
      <div className="space-y-16">
        {faqs.map((section) => (
          <div key={section.category} className="space-y-8">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary/70 border-b border-primary/10 pb-2 w-fit">
              {section.category}
            </h2>
            <div className="grid grid-cols-1 gap-10">
              {section.questions.map((faq) => (
                <div key={faq.q} className="space-y-3 max-w-2xl">
                  <h3 className="text-base font-bold tracking-tight text-foreground flex items-start gap-3">
                    <span className="text-primary/40 pt-0.5 whitespace-nowrap">Q:</span>
                    {faq.q}
                  </h3>
                  <div className="flex items-start gap-3 text-sm leading-relaxed text-muted-foreground italic">
                    <span className="text-muted-foreground/30 pt-0.5 whitespace-nowrap">A:</span>
                    {faq.a}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Support CTA */}
      <div className="p-8 rounded-lg border border-border bg-muted/20 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-md">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h4 className="text-base font-bold">Still have questions?</h4>
            <p className="text-xs text-muted-foreground">Our technical team is ready to help with your integration.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/support" className="px-5 py-2.5 bg-foreground text-background text-xs font-bold rounded-md hover:opacity-90 transition-opacity">
            Submit a Ticket
          </Link>
          <Link href="mailto:support@pricepilot.com" className="px-5 py-2.5 border border-border text-foreground text-xs font-bold rounded-md hover:bg-muted/50 transition-colors">
            Email Support
          </Link>
        </div>
      </div>
    </div>
  );
}
