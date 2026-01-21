export interface Product {
  id: string;
  sku: string;
  title: string;
  image?: string | null;
  yourPrice: number;
  compPrice: number | null;
  diff: number;
  status: string;
  match: string;
  stock: number | null;
  inStock: boolean;
  compInStock?: boolean;
  category: string;
  brand: string;
  model: string;
  siteName: string;
  url?: string | null;
  allMatches: {
    siteName: string;
    url: string;
    price: number;
    inStock: boolean;
  }[];
  isCheapest?: boolean;
  isMostExpensive?: boolean;
  priceDifference?: number;
}

export interface Stats {
  atRisk: number;
  optimal: number;
  parity: number;
  competitorOos: number;
  notFound: number;
}

export interface Competitor {
  id: string;
  name: string;
  url: string;
  products: number;
  status: string;
  health: number;
  isSyncing?: boolean;
  syncTotal?: number;
  syncProcessed?: number;
  syncLastAction?: string | null;
  syncStartedAt?: string | Date | null;
  logs?: any[];
}
