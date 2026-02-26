import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withInternalGate } from "@/lib/middleware/internal-gate";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getCachedSession } from "@/lib/auth/cached-session";

async function handlePOST() {
  try {
    const session = await getCachedSession();
    const tenantId = session!.user.tenantId;
    const results = [];

    // 1. Create User Site (Your Store) - dynamic import
    const { WebsiteService } = await import("@/lib/services/website-service");
    const userSite = await WebsiteService.createWebsite(
      {
        tenantId,
        type: "USER",
        platform: "OPENCART",
        baseUrl: "https://mystore.com",
        apiToken: "my-api-token",
      },
      session!.user.id
    );
    results.push("✓ Created user site");

    // 2. Create Competitor Sites
    const competitor1 = await prisma.site.create({
      data: {
        tenantId,
        type: "COMPETITOR",
        platform: "GENERIC",
        baseUrl: "https://techworld.com",
      },
    });

    const competitor2 = await prisma.site.create({
      data: {
        tenantId,
        type: "COMPETITOR",
        platform: "GENERIC",
        baseUrl: "https://gadgetstore.com",
      },
    });
    results.push("✓ Created 2 competitor sites");

    // 3. Create Your Products
    const userProduct1 = await prisma.product.create({
      data: {
        tenantId,
        siteId: userSite.id,
        title: "Wireless Gaming Mouse Pro",
        sku: "WGM-PRO-001",
        brand: "Logitech",
        model: "G502 Hero",
        category: "Gaming Peripherals",
        currentPrice: 79.99,
        inStock: true,
        stockLevel: 45,
        imageUrl: "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400",
        specifications: {
          dpi: "25600",
          buttons: "11",
          weight: "121g",
          connectivity: "Wired/Wireless"
        }
      },
    });

    const userProduct2 = await prisma.product.create({
      data: {
        tenantId,
        siteId: userSite.id,
        title: "Mechanical Keyboard RGB",
        sku: "MKB-RGB-002",
        brand: "Corsair",
        model: "K95 RGB Platinum",
        category: "Gaming Peripherals",
        currentPrice: 199.99,
        inStock: true,
        stockLevel: 28,
        imageUrl: "https://images.unsplash.com/photo-1595225476474-87563907a212?w=400",
        specifications: {
          switches: "Cherry MX Speed",
          backlighting: "RGB",
          layout: "Full Size"
        }
      },
    });

    const userProduct3 = await prisma.product.create({
      data: {
        tenantId,
        siteId: userSite.id,
        title: "27-inch Gaming Monitor 144Hz",
        sku: "MON-144-003",
        brand: "ASUS",
        model: "ROG Swift PG279Q",
        category: "Monitors",
        currentPrice: 599.99,
        inStock: true,
        stockLevel: 15,
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400",
        specifications: {
          resolution: "2560x1440",
          refreshRate: "144Hz",
          panelType: "IPS",
          size: "27 inch"
        }
      },
    });

    const userProduct4 = await prisma.product.create({
      data: {
        tenantId,
        siteId: userSite.id,
        title: "Gaming Headset 7.1 Surround",
        sku: "HEAD-7.1-004",
        brand: "SteelSeries",
        model: "Arctis 7",
        category: "Gaming Peripherals",
        currentPrice: 149.99,
        inStock: true,
        stockLevel: 32,
        imageUrl: "https://images.unsplash.com/photo-1599669454699-248893623440?w=400",
        specifications: {
          connectivity: "Wireless",
          battery: "24 hours",
          surround: "7.1 DTS"
        }
      },
    });

    const userProduct5 = await prisma.product.create({
      data: {
        tenantId,
        siteId: userSite.id,
        title: "USB-C Docking Station",
        sku: "DOCK-USB-005",
        brand: "CalDigit",
        model: "TS3 Plus",
        category: "Accessories",
        currentPrice: 279.99,
        inStock: true,
        stockLevel: 20,
        imageUrl: "https://images.unsplash.com/photo-1625948515291-69613efd103f?w=400",
        specifications: {
          ports: "15 ports",
          power: "87W",
          display: "Dual 4K"
        }
      },
    });

    results.push("✓ Created 5 user products");

    // 4. Create Competitor Products
    const compProduct1 = await prisma.product.create({
      data: {
        tenantId,
        siteId: competitor1.id,
        title: "Wireless Gaming Mouse Pro G502",
        sku: "COMP-WGM-001",
        brand: "Logitech",
        model: "G502 Hero",
        category: "Gaming Peripherals",
        currentPrice: 74.99,
        inStock: true,
        url: "https://techworld.com/products/g502-hero",
        imageUrl: "https://images.unsplash.com/photo-1527814050087-3793815479db?w=400",
      },
    });

    const compProduct2 = await prisma.product.create({
      data: {
        tenantId,
        siteId: competitor1.id,
        title: "Corsair K95 RGB Platinum Keyboard",
        sku: "COMP-MKB-002",
        brand: "Corsair",
        model: "K95 RGB Platinum",
        category: "Gaming Peripherals",
        currentPrice: 189.99,
        inStock: true,
        url: "https://techworld.com/products/k95-rgb",
        imageUrl: "https://images.unsplash.com/photo-1595225476474-87563907a212?w=400",
      },
    });

    const compProduct3 = await prisma.product.create({
      data: {
        tenantId,
        siteId: competitor2.id,
        title: "ASUS ROG Swift 27-inch 144Hz Monitor",
        sku: "COMP-MON-003",
        brand: "ASUS",
        model: "ROG Swift PG279Q",
        category: "Monitors",
        currentPrice: 579.99,
        inStock: true,
        url: "https://gadgetstore.com/products/rog-swift",
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400",
      },
    });

    const compProduct4 = await prisma.product.create({
      data: {
        tenantId,
        siteId: competitor2.id,
        title: "SteelSeries Arctis 7 Gaming Headset",
        sku: "COMP-HEAD-004",
        brand: "SteelSeries",
        model: "Arctis 7",
        category: "Gaming Peripherals",
        currentPrice: 139.99,
        inStock: true,
        url: "https://gadgetstore.com/products/arctis-7",
        imageUrl: "https://images.unsplash.com/photo-1599669454699-248893623440?w=400",
      },
    });

    const compProduct5 = await prisma.product.create({
      data: {
        tenantId,
        siteId: competitor1.id,
        title: "CalDigit TS3 Plus USB-C Dock",
        sku: "COMP-DOCK-005",
        brand: "CalDigit",
        model: "TS3 Plus",
        category: "Accessories",
        currentPrice: 269.99,
        inStock: true,
        url: "https://techworld.com/products/ts3-plus",
        imageUrl: "https://images.unsplash.com/photo-1625948515291-69613efd103f?w=400",
      },
    });

    results.push("✓ Created 5 competitor products");

    // 5. Create Product Matches
    await prisma.productMatch.createMany({
      data: [
        {
          userProductId: userProduct1.id,
          competitorProductId: compProduct1.id,
          matchType: "AUTO_MODEL",
          confidenceScore: 98.5,
          status: "APPROVED",
        },
        {
          userProductId: userProduct2.id,
          competitorProductId: compProduct2.id,
          matchType: "AUTO_MODEL",
          confidenceScore: 97.0,
          status: "APPROVED",
        },
        {
          userProductId: userProduct3.id,
          competitorProductId: compProduct3.id,
          matchType: "AUTO_MODEL",
          confidenceScore: 96.5,
          status: "APPROVED",
        },
        {
          userProductId: userProduct4.id,
          competitorProductId: compProduct4.id,
          matchType: "AUTO_MODEL",
          confidenceScore: 95.0,
          status: "APPROVED",
        },
        {
          userProductId: userProduct5.id,
          competitorProductId: compProduct5.id,
          matchType: "AUTO_MODEL",
          confidenceScore: 94.0,
          status: "PENDING",
        },
      ],
    });
    results.push("✓ Created 5 product matches");

    // 6. Create Price History
    await prisma.priceHistory.createMany({
      data: [
        { productId: userProduct1.id, price: 79.99, recordedAt: new Date() },
        { productId: userProduct1.id, price: 84.99, recordedAt: new Date(Date.now() - 86400000) },
        { productId: compProduct1.id, price: 74.99, recordedAt: new Date() },
        { productId: compProduct1.id, price: 79.99, recordedAt: new Date(Date.now() - 86400000) },
        { productId: userProduct2.id, price: 199.99, recordedAt: new Date() },
        { productId: compProduct2.id, price: 189.99, recordedAt: new Date() },
      ],
    });
    results.push("✓ Created price history");

    // 7. Create a Pricing Rule
    await prisma.pricingRule.create({
      data: {
        tenantId,
        name: "Competitive Undercut",
        description: "Stay $5 below competitors",
        strategy: "UNDERCUT",
        parameter: 5.0,
        priority: 1,
        isActive: true,
      },
    });
    results.push("✓ Created pricing rule");

    return NextResponse.json({
      success: true,
      message: "Data seeded successfully!",
      results,
      summary: {
        userProducts: 5,
        competitorSites: 2,
        competitorProducts: 5,
        matches: 5,
        priceHistory: 6,
        pricingRules: 1
      }
    });

  } catch (error: any) {
    console.error("Seed error:", error);
    return NextResponse.json({
      error: error.message,
      details: error.stack
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return withInternalGate(req, (r) => withRequestContextAndRateLimit(r, "auth", handlePOST));
}
