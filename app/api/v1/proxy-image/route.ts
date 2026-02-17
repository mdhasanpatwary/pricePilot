import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";

const NEGATIVE_CACHE_TTL_MS = Number.parseInt(
  process.env.PROXY_IMAGE_NEGATIVE_CACHE_TTL_MS || "300000",
  10,
);
const NEGATIVE_CACHE_MAX_ENTRIES = Number.parseInt(
  process.env.PROXY_IMAGE_NEGATIVE_CACHE_MAX_ENTRIES || "1000",
  10,
);

type NegativeCacheEntry = {
  expiresAt: number;
};

type FetchedImage = {
  data: ArrayBuffer;
  contentType: string;
};

const negativeCache = new Map<string, NegativeCacheEntry>();
const inFlightRequests = new Map<string, Promise<FetchedImage>>();

function getNegativeCacheHit(targetUrl: string): boolean {
  const entry = negativeCache.get(targetUrl);
  if (!entry) return false;

  if (entry.expiresAt <= Date.now()) {
    negativeCache.delete(targetUrl);
    return false;
  }

  return true;
}

function setNegativeCache(targetUrl: string): void {
  if (negativeCache.size >= NEGATIVE_CACHE_MAX_ENTRIES) {
    const firstKey = negativeCache.keys().next().value;
    if (firstKey) negativeCache.delete(firstKey);
  }

  negativeCache.set(targetUrl, {
    expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS,
  });
}

async function fetchImageBuffer(targetUrl: string): Promise<FetchedImage> {
  const existing = inFlightRequests.get(targetUrl);
  if (existing) {
    return existing;
  }

  const parsedUrl = new URL(targetUrl);
  const request = axios
    .get(targetUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "image/*",
        Referer: parsedUrl.origin,
      },
      timeout: 10000,
    })
    .then((response) => {
      const responseData = response.data as ArrayBuffer | Uint8Array;
      const data =
        responseData instanceof ArrayBuffer
          ? responseData
          : (responseData.buffer.slice(
            responseData.byteOffset,
            responseData.byteOffset + responseData.byteLength,
          ) as ArrayBuffer);

      return {
        data,
        contentType: response.headers["content-type"] || "image/jpeg",
      };
    })
    .finally(() => {
      inFlightRequests.delete(targetUrl);
    });

  inFlightRequests.set(targetUrl, request);
  return request;
}

async function handleGET(req: NextRequest) {
  const session = await getCachedSession();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("No URL provided", { status: 400 });
  }

  let targetUrl = url;
  if (targetUrl.startsWith("//")) {
    targetUrl = `https:${targetUrl}`;
  }

  if (getNegativeCacheHit(targetUrl)) {
    return new NextResponse("Image not found", {
      status: 404,
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  try {
    const image = await fetchImageBuffer(targetUrl);
    negativeCache.delete(targetUrl);

    return new NextResponse(image.data, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      if (status === 404) {
        setNegativeCache(targetUrl);

        // 404 for remote images is common; keep logs compact to avoid noise.
        console.warn("Image proxy upstream 404", { targetUrl });
        return new NextResponse("Image not found", {
          status: 404,
          headers: {
            "Cache-Control": "public, max-age=300",
          },
        });
      }

      console.warn("Image proxy upstream error", {
        targetUrl,
        status: status ?? "unknown",
        code: error.code ?? "unknown",
      });
    } else {
      console.warn("Image proxy unexpected error", { targetUrl });
    }

    return new NextResponse("Failed to fetch image", { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, 'read', () => handleGET(req));
}
