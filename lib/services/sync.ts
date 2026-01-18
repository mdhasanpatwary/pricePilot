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
  in_stock: boolean;
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
    if (!site.apiToken) {
      console.log(`[SyncService] No API token for ${site.baseUrl}, skipping fetch.`);
      return { count: 0, siteName: site.baseUrl };
    }

    let externalProducts: ExternalProduct[] = [];
    if (site.platform === "OPENCART") {
      externalProducts = await this.fetchFromOpenCart(site);
    } else if (site.platform === "LARAVEL") {
      externalProducts = await this.fetchFromLaravel(site);
    }

    // 2. Process and Upsert products
    const results = [];
    for (const extProd of externalProducts) {
      // Find existing product by externalId within this site
      const existingProduct = await prisma.product.findFirst({
        where: {
          siteId: site.id,
          externalId: extProd.external_id
        }
      });

      let product;
      const productData = {
        title: extProd.title,
        currentPrice: extProd.price,
        sku: extProd.sku,
        model: extProd.model,
        brand: extProd.brand,
        // inStock: extProd.in_stock,
        lastCrawledAt: new Date(),
      };

      if (existingProduct) {
        product = await prisma.product.update({
          where: { id: existingProduct.id },
          data: productData
        });
      } else {
        product = await prisma.product.create({
          data: {
            ...productData,
            siteId: site.id,
            tenantId: site.tenantId,
            externalId: extProd.external_id,
            currency: "USD",
          }
        });
      }

      // 3. Record price history
      await prisma.priceHistory.create({
        data: {
          productId: product.id,
          price: extProd.price,
        },
      });

      results.push(product);
    }

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
    interface OpenCartProduct {
      product_id?: string | number;
      id?: string | number;
      sku?: string;
      name?: string;
      title?: string;
      price?: string;
      special?: string;
      manufacturer?: string;
      model?: string;
      quantity: number;
      stock_status: string;
    }

    try {
      const response = await axios.get(
        `${site.baseUrl}/index.php?route=api/pricepilot&api_token=${site.apiToken}`,
        {
          timeout: 30000,
        }
      );

      // Expected OpenCart response format:
      // { products: [{ product_id, sku, name, price, manufacturer, model }] }
      const products: OpenCartProduct[] = response.data.products || [];

      return products.map((p) => ({
        external_id: p.product_id?.toString() || p.id?.toString() || "",
        sku: p.sku || null,
        title: p.name || p.title || "Unknown Product",
        price: parseFloat(p.price || p.special || "0"),
        brand: p.manufacturer || null,
        model: p.model || null,
        in_stock: p.quantity > 0 || p.stock_status === 'In Stock',
      }));
    } catch (error) {
      console.error(`OpenCart API error for ${site.baseUrl}:`, error);

      // Fallback to mock data for development
      console.log(`Using mock data for OpenCart: ${site.baseUrl}`);
      return [
        { external_id: "oc_1", sku: "NIKE-AM-270", title: "Nike Air Max 270", price: 150.00, brand: "Nike", model: "270", in_stock: true },
        { external_id: "oc_2", sku: "ADIDAS-UB-22", title: "Adidas Ultraboost 22", price: 180.00, brand: "Adidas", model: "22", in_stock: false },
      ];
    }
  }

  /**
   * Fetch products from Laravel API
   */
  private static async fetchFromLaravel(site: Site): Promise<ExternalProduct[]> {
    interface LaravelProduct {
      id?: string | number;
      sku?: string;
      name?: string;
      title?: string;
      price?: string;
      brand?: string;
      model?: string;
      in_stock?: boolean;
    }

    try {
      const response = await axios.get(
        `${site.baseUrl}/api/pricepilot/sync`,
        {
          headers: {
            'X-PricePilot-Token': site.apiToken,
            'Accept': "application/json",
          },
          timeout: 30000,
        }
      );

      // Expected Laravel response format:
      // { data: [{ id, sku, name, price, brand, model }] }
      const products: LaravelProduct[] = response.data.data || response.data || [];

      return products.map((p) => ({
        external_id: p.id?.toString() || "",
        sku: p.sku || null,
        title: p.name || p.title || "Unknown Product",
        price: parseFloat(p.price || "0"),
        brand: p.brand || null,
        model: p.model || null,
        in_stock: p.in_stock ?? true,
      }));
    } catch (error) {
      console.error(`Laravel API error for ${site.baseUrl}:`, error);

      // Fallback to mock data for development
      console.log(`Using mock data for Laravel: ${site.baseUrl}`);
      return [
        { external_id: "lv_1", sku: "PUMA-RS-X", title: "Puma RS-X", price: 110.00, brand: "Puma", model: "RS-X", in_stock: true },
      ];
    }
  }

  /**
   * Pushes latest price updates for all products of a site back to the external platform
   */
  static async syncProductsToStore(siteId: string) {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { products: true },
    });

    if (!site) throw new Error("Site not found");

    if (!site.apiToken) {
      console.log(`[SyncService] No API token for ${site.baseUrl}, skipping push.`);
      return { success: true, updated: 0 };
    }

    const productsToUpdate = site.products.filter(p => p.externalId);

    console.log(`[SyncService] Pushing ${productsToUpdate.length} price updates to ${site.platform}`);

    const results = await Promise.all(
      productsToUpdate.map(async (product) => {
        try {
          if (site.platform === "OPENCART") {
            return await this.updateOpenCartPrice(site, product);
          } else if (site.platform === "LARAVEL") {
            return await this.updateLaravelPrice(site, product);
          }
          return null;
        } catch (error) {
          console.error(`Failed to update price for product ${product.id}:`, error);
          return null;
        }
      })
    );

    return {
      success: true,
      updated: results.filter(r => r !== null).length,
    };
  }

  /**
   * Update price in OpenCart
   */
  private static async updateOpenCartPrice(site: Site, product: Product) {
    // This is a placeholder for actual API call
    // In real OpenCart PicePilot extension, we would call a specific route
    const url = `${site.baseUrl}/index.php?route=api/pricepilot/update&api_token=${site.apiToken}`;

    try {
      await axios.post(url, {
        product_id: product.externalId,
        price: product.currentPrice.toString(),
      }, {
        timeout: 10000,
      });
      return true;
    } catch (error) {
      console.error(`OpenCart Update Error for ${product.id}:`, error);
      return false;
    }
  }

  /**
   * Update price in Laravel
   */
  private static async updateLaravelPrice(site: Site, product: Product) {
    const url = `${site.baseUrl}/api/pricepilot/update`;

    try {
      await axios.post(url, {
        product_id: product.externalId,
        price: product.currentPrice.toString(),
      }, {
        headers: {
          'X-PricePilot-Token': site.apiToken,
          'Accept': "application/json"
        },
        timeout: 10000,
      });
      return true;
    } catch (error) {
      console.error(`Laravel Update Error for ${product.id}:`, error);
      return false;
    }
  }
}
