
"use client";

import { useState } from "react";
import Image from "next/image";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  onError?: () => void;
}

export function ProductImage({
  src,
  alt,
  className,
  containerClassName,
  fill = true,
  priority = false,
  sizes,
  onError
}: ProductImageProps) {
  const [error, setError] = useState(false);
  const [lastSrc, setLastSrc] = useState(src);

  // Reset error state if src changes
  if (src !== lastSrc) {
    setLastSrc(src);
    setError(false);
  }

  if (!src || error) {
    return (
      <div className={cn("flex items-center justify-center h-full w-full text-primary bg-primary/5", containerClassName)}>
        <Zap className="w-5 h-5 opacity-40 fill-current" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      priority={priority}
      className={cn("object-cover", className)}
      sizes={sizes}
      onError={() => {
        setError(true);
        if (onError) onError();
      }}
    />
  );
}
