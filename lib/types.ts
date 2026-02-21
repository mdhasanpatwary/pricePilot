import { EnhancedTableProps, EnhancedFormProps, EnhancedSheetProps } from "./types/shadcn-ui";

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
  specifications?: Record<string, string>;
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
  totalUserProducts?: number;
  isAdvancedProtected?: boolean;
  advancedAccessStatus?: "NOT_REQUIRED" | "REQUIRES_SETUP" | "READY";
  advancedAccessRequiredAt?: string | Date | null;
  advancedAccessReason?: string | null;
  searchQueryPattern?: string | null;
  logs?: any[];
}

// Enhanced component interfaces that extend shadcn/ui types
export interface ProductTableProps extends EnhancedTableProps<Product> {
  currency: string;
  onProductSelect?: (product: Product) => void;
  onBulkUpdate?: (products: Product[]) => void;
}

export interface BulkUpdateFormProps extends EnhancedFormProps {
  selectedCount: number;
  onExecute: (logic: BulkUpdateFormValues) => Promise<void>;
}

export interface ProductDetailDrawerProps extends EnhancedSheetProps {
  product: Product | null;
  currency?: string;
  onExecute?: (productId: string) => Promise<void>;
  onRefresh?: () => void;
}

// Form data types with proper validation
export interface BulkUpdateFormValues {
  logicType: "FIXED" | "PERCENTAGE";
  value: number;
  minPrice?: number;
}
