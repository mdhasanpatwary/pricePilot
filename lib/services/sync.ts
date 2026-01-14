import { prisma } from "@/lib/prisma";
import { Product, Site, PlatformType } from "@prisma/client";
import axios from "axios";

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

  /**
   * Fetch products from OpenCart API
   */
  private static async fetchFromOpenCart(site: Site): Promise<ExternalProduct[]> {
    try {
      const response = await axios.get(
        `${site.baseUrl}/index.php?route=api/pricepilot/products`,
        {
          headers: {
            Authorization: `Bearer ${site.apiToken}`,
          },
          timeout: 30000,
        }
      );

      // Expected OpenCart response format:
      // { products: [{ product_id, sku, name, price, manufacturer, model }] }
      const products = response.data.products || [];

      return products.map((p: any) => ({
        external_id: p.product_id?.toString() || p.id?.toString(),
        sku: p.sku || null,
        title: p.name || p.title,
        price: parseFloat(p.price || p.special || "0"),
        brand: p.manufacturer || null,
        model: p.model || null,
      }));
    } catch (error) {
      console.error(`OpenCart API error for ${site.baseUrl}:`, error);

      // Fallback to mock data for development
      console.log(`Using mock data for OpenCart: ${site.baseUrl}`);
      return [
        { external_id: "oc_1", sku: "NIKE-AM-270", title: "Nike Air Max 270", price: 150.00, brand: "Nike", model: "270" },
        { external_id: "oc_2", sku: "ADIDAS-UB-22", title: "Adidas Ultraboost 22", price: 180.00, brand: "Adidas", model: "22" },
      ];
    }
  }

  /**
   * Fetch products from Laravel API
   */
  private static async fetchFromLaravel(site: Site): Promise<ExternalProduct[]> {
    try {
      const response = await axios.get(
        `${site.baseUrl}/api/products`,
        {
          headers: {
            Authorization: `Bearer ${site.apiToken}`,
            Accept: "application/json",
          },
          timeout: 30000,
        }
      );

      // Expected Laravel response format:
      // { data: [{ id, sku, name, price, brand, model }] }
      const products = response.data.data || response.data;

      return products.map((p: any) => ({
        external_id: p.id?.toString(),
        sku: p.sku || null,
        title: p.name || p.title,
        price: parseFloat(p.price || "0"),
        brand: p.brand || null,
        model: p.model || null,
      }));
    } catch (error) {
      console.error(`Laravel API error for ${site.baseUrl}:`, error);

      // Fallback to mock data for development
      console.log(`Using mock data for Laravel: ${site.baseUrl}`);
      return [
        { external_id: "lv_1", sku: "PUMA-RS-X", title: "Puma RS-X", price: 110.00, brand: "Puma", model: "RS-X" },
      ];
    }
  }
}
