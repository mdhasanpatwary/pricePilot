import { prisma } from "@/lib/prisma";
import { Product, Site, PlatformType } from "@prisma/client";

interface ExternalProduct {
  external_id: string;
  sku: string | null;
  title: string;
  price: number;
  brand: string | null;
  model: string | null;
  id?: string;
}

export class SyncService {
  /**
   * Triggers a sync for a specific site
   */
  static async syncSite(siteId: string) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { tenant: true },
    });

    if (!site) throw new Error("Site not found");

    // 1. Fetch products from external platform
    let externalProducts: ExternalProduct[] = [];
    if (site.platform === "OPENCART") {
      externalProducts = await this.fetchFromOpenCart(site);
    } else if (site.platform === "LARAVEL") {
      externalProducts = await this.fetchFromLaravel(site);
    }

    // 2. Process and Upsert products
    const results = await Promise.all(
      externalProducts.map(async (extProd) => {
        const product = await prisma.product.upsert({
          where: {
            // We'll use a unique constraint on tenantId + externalId in real world,
            // for now, let's assume externalId is unique enough with siteId
            id: extProd.id || undefined,
          },
          update: {
            title: extProd.title,
            currentPrice: extProd.price,
            sku: extProd.sku,
            model: extProd.model,
            brand: extProd.brand,
            lastCrawledAt: new Date(),
          },
          create: {
            siteId: site.id,
            tenantId: site.tenantId,
            externalId: extProd.external_id,
            sku: extProd.sku,
            title: extProd.title,
            brand: extProd.brand,
            model: extProd.model,
            currentPrice: extProd.price,
            currency: site.platform === "OPENCART" ? "USD" : "USD", // Example
          },
        });

        // 3. Record price history
        await prisma.priceHistory.create({
          data: {
            productId: product.id,
            price: extProd.price,
          },
        });

        return product;
      })
    );

    // 4. Update last sync time
    await prisma.site.update({
      where: { id: siteId },
      data: { lastSyncAt: new Date() },
    });

    return {
      count: results.length,
      siteName: site.baseUrl,
    };
  }

  private static async fetchFromOpenCart(site: Site) {
    // Mocking the call to OpenCart API
    // In production: fetch(`${site.baseUrl}/index.php?route=api/pricepilot/products&api_token=${site.apiToken}`)
    console.log(`Fetching from OpenCart: ${site.baseUrl}`);
    return [
      { external_id: "oc_1", sku: "NIKE-AM-270", title: "Nike Air Max 270", price: 150.00, brand: "Nike", model: "270" },
      { external_id: "oc_2", sku: "ADIDAS-UB-22", title: "Adidas Ultraboost 22", price: 180.00, brand: "Adidas", model: "22" },
    ];
  }

  private static async fetchFromLaravel(site: Site) {
    // Mocking the call to Laravel API
    console.log(`Fetching from Laravel: ${site.baseUrl}`);
    return [
      { external_id: "lv_1", sku: "PUMA-RS-X", title: "Puma RS-X", price: 110.00, brand: "Puma", model: "RS-X" },
    ];
  }
}
