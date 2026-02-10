import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import axios from "axios";
import { withRateLimit } from "@/lib/middleware/ratelimit";

async function handleGET(req: NextRequest) {
  const session = await getServerSession(authOptions);
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

  try {
    const parsedUrl = new URL(targetUrl);
    const response = await axios.get(targetUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "image/*",
        Referer: parsedUrl.origin,
      },
      timeout: 10000,
    });

    const contentType = response.headers["content-type"] || "image/jpeg";

    return new NextResponse(response.data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);
    return new NextResponse("Failed to fetch image", { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  return withRateLimit(req, 'read', () => handleGET(req));
}
