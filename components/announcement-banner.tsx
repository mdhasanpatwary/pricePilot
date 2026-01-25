"use client";

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AnnouncementBannerProps {
  id: string;
  message: string;
  ctaText?: string;
  ctaLink?: string;
  variant?: "default" | "success" | "info";
}

export default function AnnouncementBanner({
  id,
  message,
  ctaText,
  ctaLink,
  variant = "default",
}: AnnouncementBannerProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has dismissed this announcement
    const timer = setTimeout(() => {
      const dismissed = localStorage.getItem(`announcement-dismissed-${id}`);
      if (!dismissed) {
        setIsVisible(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [id]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(`announcement-dismissed-${id}`, "true");
  };

  if (!isVisible) return null;

  const variantStyles = {
    default: "bg-primary/5 border-primary/10 text-primary",
    success: "bg-success/5 border-success/10 text-success",
    info: "bg-blue-500/5 border-blue-500/10 text-blue-600 dark:text-blue-400",
  };

  return (
    <div
      className={`relative flex items-center justify-between gap-4 px-4 py-3 rounded-lg border ${variantStyles[variant]} animate-in slide-in-from-top duration-500`}
    >
      <div className="flex items-center gap-3 flex-1">
        <Sparkles className="w-5 h-5 shrink-0" />
        <p className="text-sm font-semibold">{message}</p>
      </div>

      <div className="flex items-center gap-3">
        {ctaText && ctaLink && (
          <Button asChild size="sm" className="px-4 py-1.5">
            <Link href={ctaLink}>
              {ctaText}
            </Link>
          </Button>
        )}
        <Button
          onClick={handleDismiss}
          variant="ghost"
          size="sm"
          className="p-1 hover:bg-background/50 rounded transition-colors"
          aria-label="Dismiss announcement"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
