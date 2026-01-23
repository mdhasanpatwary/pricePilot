// Removed unused NextRequest import
import { GET, POST, DELETE } from "@/app/api/v1/integrations/route";

// Mock NextAuth
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

// Mock authOptions to avoid ESM issues
jest.mock("@/lib/auth", () => ({
  authOptions: {},
}));

// Mock Rate Limiter Middleware
jest.mock("@/lib/middleware/ratelimit", () => ({
  withRateLimit: jest
    .fn()
    .mockImplementation((req, _type, handler) => handler(req)),
  getRateLimiterType: jest.fn(),
  createRateLimitResponse: jest.fn(),
}));

// Mock Next.js Request/Response
jest.mock("next/server", () => ({
  NextRequest: jest.fn().mockImplementation((url, options) => ({
    url,
    method: options?.method || "GET",
    json: jest
      .fn()
      .mockResolvedValue(options?.body ? JSON.parse(options.body) : {}),
    nextUrl: new URL(url),
  })),
  NextResponse: {
    json: jest.fn().mockImplementation((data, init) => ({
      status: init?.status || 200,
      json: jest.fn().mockResolvedValue(data),
      headers: new Map(),
    })),
  },
}));

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    site: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    tenantAuditLog: {
      create: jest.fn().mockResolvedValue({ id: "log-1" }),
    },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";

describe("/api/integrations", () => {
  const mockSession = {
    user: {
      id: "test-user-123",
      tenantId: "test-tenant-123",
      email: "test@example.com",
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET", () => {
    it("should return 401 if not authenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const req = {
        url: "http://localhost:3000/api/v1/integrations",
        nextUrl: new URL("http://localhost:3000/api/v1/integrations"),
        headers: new Map(),
      } as any;
      const response = await GET(req);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("should return list of integrations for authenticated user", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSites = [
        {
          id: "site-1",
          platform: "OPENCART",
          type: "USER",
          baseUrl: "https://mystore.com",
          lastSyncAt: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
          _count: { products: 100 },
        },
      ];

      (prisma.site.findMany as jest.Mock).mockResolvedValue(mockSites);

      const req = {
        url: "http://localhost:3000/api/v1/integrations",
        nextUrl: new URL("http://localhost:3000/api/v1/integrations"),
        headers: new Map(),
      } as any;
      const response = await GET(req);

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0]).toMatchObject({
        id: "site-1",
        platform: "OPENCART",
        type: "USER",
        url: "https://mystore.com",
        products: 100,
        status: "CONNECTED",
      });
    });
  });

  describe("POST", () => {
    it("should return 401 if not authenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const req = {
        url: "http://localhost:3000/api/v1/integrations",
        method: "POST",
        headers: new Map(),
        json: jest.fn().mockResolvedValue({
          platform: "OPENCART",
          baseUrl: "https://mystore.com",
          apiToken: "test-token",
        }),
      } as any;

      const response = await POST(req);

      expect(response.status).toBe(401);
    });

    it("should return 400 if required fields are missing", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const req = {
        url: "http://localhost:3000/api/integrations",
        method: "POST",
        json: jest.fn().mockResolvedValue({
          platform: "OPENCART",
        }),
      } as any;

      const response = await POST(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Validation failed");
    });

    it("should return 400 if URL is invalid", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const req = {
        url: "http://localhost:3000/api/integrations",
        method: "POST",
        json: jest.fn().mockResolvedValue({
          platform: "OPENCART",
          baseUrl: "not-a-valid-url",
          apiToken: "test-token",
        }),
      } as any;

      const response = await POST(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Validation failed");
    });

    it("should create new integration successfully", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSite = {
        id: "site-1",
        platform: "OPENCART",
        type: "USER",
        baseUrl: "https://mystore.com",
        apiToken: "test-token",
        tenantId: "test-tenant-123",
      };

      (prisma.tenant.findUnique as jest.Mock).mockResolvedValue({
        id: "test-tenant-123",
        storeLimit: 5,
      });
      (prisma.site.count as jest.Mock).mockResolvedValue(1);
      (prisma.site.create as jest.Mock).mockResolvedValue(mockSite);

      const req = {
        url: "http://localhost:3000/api/v1/integrations",
        method: "POST",
        headers: new Map([["x-forwarded-for", "127.0.0.1"]]),
        json: jest.fn().mockResolvedValue({
          platform: "OPENCART",
          baseUrl: "https://mystore.com",
          apiToken: "test-token",
          type: "USER",
        }),
      } as any;

      const response = await POST(req);

      expect(response.status).toBe(201);
      const data = await response.json();

      expect(data).toMatchObject({
        id: "site-1",
        platform: "OPENCART",
        type: "USER",
        url: "https://mystore.com",
        status: "CONNECTED",
      });

      expect(prisma.site.create).toHaveBeenCalledWith({
        data: {
          tenantId: "test-tenant-123",
          platform: "OPENCART",
          type: "USER",
          baseUrl: "https://mystore.com",
          apiToken: "test-token",
        },
      });
    });
  });

  describe("DELETE", () => {
    it("should return 401 if not authenticated", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const req = {
        url: "http://localhost:3000/api/integrations?id=site-1",
        nextUrl: new URL("http://localhost:3000/api/integrations?id=site-1"),
        method: "DELETE",
      } as any;

      const response = await DELETE(req);

      expect(response.status).toBe(401);
    });

    it("should return 400 if site ID is missing", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const req = {
        url: "http://localhost:3000/api/integrations",
        nextUrl: new URL("http://localhost:3000/api/integrations"),
        method: "DELETE",
      } as any;

      const response = await DELETE(req);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("Site ID required");
    });

    it("should return 404 if site not found or not owned by user", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      (prisma.site.findFirst as jest.Mock).mockResolvedValue(null);

      const req = {
        url: "http://localhost:3000/api/integrations?id=site-1",
        nextUrl: new URL("http://localhost:3000/api/integrations?id=site-1"),
        method: "DELETE",
      } as any;

      const response = await DELETE(req);

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe("Site not found");
    });

    it("should delete integration successfully", async () => {
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const mockSite = {
        id: "site-1",
        tenantId: "test-tenant-123",
      };

      (prisma.site.findFirst as jest.Mock).mockResolvedValue(mockSite);
      (prisma.site.delete as jest.Mock).mockResolvedValue(mockSite);

      const req = {
        url: "http://localhost:3000/api/v1/integrations?id=site-1",
        nextUrl: new URL("http://localhost:3000/api/v1/integrations?id=site-1"),
        method: "DELETE",
        headers: new Map([["x-forwarded-for", "127.0.0.1"]]),
      } as any;

      const response = await DELETE(req);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      expect(prisma.site.delete).toHaveBeenCalledWith({
        where: { id: "site-1" },
      });
    });
  });
});
