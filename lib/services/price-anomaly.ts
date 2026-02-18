export type PriceAnomalyReason =
  | "PRICE_ZERO_NOT_OOS"
  | "IMPLAUSIBLE_LOW_ABSOLUTE"
  | "IMPLAUSIBLE_LOW_RELATIVE"
  | "SUDDEN_DROP_80PCT";

export interface PriceAnomalyResult {
  flagged: boolean;
  reasons: PriceAnomalyReason[];
  details: Record<string, unknown>;
}

export function detectPriceAnomaly(input: {
  newPrice: number;
  oldPrice?: number | null;
  inStock: boolean;
  explicitOos?: boolean;
  currency?: string | null;
}): PriceAnomalyResult {
  const reasons: PriceAnomalyReason[] = [];
  const details: Record<string, unknown> = {
    newPrice: input.newPrice,
    oldPrice: input.oldPrice ?? null,
    inStock: input.inStock,
    explicitOos: !!input.explicitOos,
    currency: input.currency ?? null,
  };

  // Flag price=0 unless the scraper explicitly detected OOS state.
  if (input.newPrice === 0 && input.inStock && !input.explicitOos) {
    reasons.push("PRICE_ZERO_NOT_OOS");
  }

  const oldPrice = input.oldPrice ?? null;
  if (oldPrice !== null && oldPrice > 0 && input.newPrice > 0) {
    const dropPct = ((oldPrice - input.newPrice) / oldPrice) * 100;
    details.dropPct = dropPct;

    if (dropPct >= 80) {
      reasons.push("SUDDEN_DROP_80PCT");
    }

    // Relative implausible-low check (separate from the 80% drop detection).
    if (dropPct >= 90) {
      reasons.push("IMPLAUSIBLE_LOW_RELATIVE");
    }
  }

  // Absolute implausible-low check (currency-aware but conservative).
  if (input.newPrice > 0) {
    const currency = (input.currency || "").toUpperCase();
    const absoluteFloor =
      currency === "BDT"
        ? 50
        : currency === "USD" || currency === "EUR" || currency === "GBP"
          ? 0.5
          : 1;

    details.absoluteFloor = absoluteFloor;
    if (input.newPrice < absoluteFloor) {
      reasons.push("IMPLAUSIBLE_LOW_ABSOLUTE");
    }
  }

  return {
    flagged: reasons.length > 0,
    reasons,
    details,
  };
}

