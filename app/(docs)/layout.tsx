import { Inter } from "next/font/google";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "PricePilot Documentation",
  description: "Professional guides and API reference for the PricePilot e-commerce optimization platform.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={`${inter.variable} font-sans bg-background text-foreground antialiased selection:bg-primary/10 selection:text-primary`}>
        <div className="flex min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
