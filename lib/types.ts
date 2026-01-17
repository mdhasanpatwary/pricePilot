export interface Product {
  id: string;
  sku: string;
  title: string;
  yourPrice: number;
  compPrice: number;
  diff: number;
  status: string;
  match: string;
  stock: number;
  inStock: boolean;
}

export interface Stats {
  atRisk: number;
  optimal: number;
  parity: number;
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
