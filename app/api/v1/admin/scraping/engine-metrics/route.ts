import { NextRequest, NextResponse } from "next/server";

import { getCachedSession } from "@/lib/auth/cached-session";
import { withRequestContextAndRateLimit } from "@/lib/middleware/with-request-context";
import { getRedisConnection } from "@/lib/queue/connection";

export const dynamic = "force-dynamic";

const METRIC_KEY_PREFIX = "pp:scrape:engine:minute:";
const ANON_METRIC_KEY_PREFIX = "pp:scrape:anon:minute:";
const OPERATIONS = ["searchAndScrape", "scrapeByUrl"] as const;
const ENGINES = ["legacy", "bot"] as const;
const CONTEXTS = ["discovery", "worker", "retry"] as const;
const WINDOW_MINUTES = 60;

interface OperationAggregate {
  total: number;
  success: number;
  failed: number;
  byEngine: Record<string, { total: number; success: number; failed: number }>;
  byContext: Record<string, { total: number; success: number; failed: number }>;
}

const toNumber = (value: string | undefined): number => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createOperationAggregate = (): OperationAggregate => ({
  total: 0,
  success: 0,
  failed: 0,
  byEngine: Object.fromEntries(
    ENGINES.map((engine) => [engine, { total: 0, success: 0, failed: 0 }]),
  ),
  byContext: Object.fromEntries(
    CONTEXTS.map((context) => [context, { total: 0, success: 0, failed: 0 }]),
  ),
});

async function handleGET() {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const isAdmin = user.role === "ADMIN" || user.isSuperAdmin === true;
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
  }

  const redis = getRedisConnection();
  const nowMinuteBucket = Math.floor(Date.now() / 60_000);

  const pipeline = redis.pipeline();
  const keyRefs: Array<{ operation: (typeof OPERATIONS)[number]; key: string }> = [];

  for (const operation of OPERATIONS) {
    for (let minuteOffset = 0; minuteOffset < WINDOW_MINUTES; minuteOffset += 1) {
      const minuteBucket = nowMinuteBucket - minuteOffset;
      const key = `${METRIC_KEY_PREFIX}${operation}:${minuteBucket}`;
      keyRefs.push({ operation, key });
      pipeline.hgetall(key);
    }
  }

  const anonKeys: string[] = [];
  for (let minuteOffset = 0; minuteOffset < WINDOW_MINUTES; minuteOffset += 1) {
    const minuteBucket = nowMinuteBucket - minuteOffset;
    const key = `${ANON_METRIC_KEY_PREFIX}${minuteBucket}`;
    anonKeys.push(key);
    pipeline.hgetall(key);
  }

  const rawResults = await pipeline.exec();

  const operations: Record<(typeof OPERATIONS)[number], OperationAggregate> = {
    searchAndScrape: createOperationAggregate(),
    scrapeByUrl: createOperationAggregate(),
  };

  const fallbackByReason: Record<string, number> = {};

  rawResults?.forEach((row, index) => {
    if (!row) return;

    const [err, value] = row;
    if (err || !value || typeof value !== "object") {
      return;
    }

    const keyRef = keyRefs[index];
    if (!keyRef) {
      return;
    }

    const aggregate = operations[keyRef.operation];
    const hash = value as Record<string, string>;

    aggregate.total += toNumber(hash.total);
    aggregate.success += toNumber(hash["engine:legacy:success"]) + toNumber(hash["engine:bot:success"]);
    aggregate.failed += toNumber(hash["engine:legacy:failed"]) + toNumber(hash["engine:bot:failed"]);

    for (const engine of ENGINES) {
      aggregate.byEngine[engine].total += toNumber(hash[`engine:${engine}:total`]);
      aggregate.byEngine[engine].success += toNumber(hash[`engine:${engine}:success`]);
      aggregate.byEngine[engine].failed += toNumber(hash[`engine:${engine}:failed`]);
    }

    for (const context of CONTEXTS) {
      aggregate.byContext[context].total += toNumber(hash[`context:${context}:total`]);
      aggregate.byContext[context].success += toNumber(hash[`context:${context}:success`]);
      aggregate.byContext[context].failed += toNumber(hash[`context:${context}:failed`]);
    }

    for (const [field, raw] of Object.entries(hash)) {
      if (!field.startsWith("fallback:")) continue;
      const reason = field.replace("fallback:", "") || "unknown";
      fallbackByReason[reason] = (fallbackByReason[reason] || 0) + toNumber(raw);
    }
  });

  const total = OPERATIONS.reduce((sum, operation) => sum + operations[operation].total, 0);
  const success = OPERATIONS.reduce((sum, operation) => sum + operations[operation].success, 0);
  const failed = OPERATIONS.reduce((sum, operation) => sum + operations[operation].failed, 0);
  const fallbackTotal = Object.values(fallbackByReason).reduce((sum, value) => sum + value, 0);

  const anonymous = {
    total: 0,
    success: 0,
    failed: 0,
    protectionDetected: 0,
    method: {
      api: 0,
      html: 0,
      unknown: 0,
    },
  };

  for (let i = keyRefs.length; i < keyRefs.length + anonKeys.length; i += 1) {
    const row = rawResults?.[i];
    if (!row) continue;
    const [err, value] = row;
    if (err || !value || typeof value !== "object") continue;
    const hash = value as Record<string, string>;

    anonymous.total += toNumber(hash.total);
    anonymous.success += toNumber(hash.success);
    anonymous.failed += toNumber(hash.failed);
    anonymous.protectionDetected += toNumber(hash.protectionDetected);
    anonymous.method.api += toNumber(hash["method:api"]);
    anonymous.method.html += toNumber(hash["method:html"]);
    anonymous.method.unknown += toNumber(hash["method:unknown"]);
  }

  return NextResponse.json({
    success: true,
    data: {
      config: {
        primaryEngine: process.env.SCRAPING_ENGINE_PRIMARY || "bot",
        discoveryUseBot: process.env.SCRAPING_ENGINE_DISCOVERY_USE_BOT === "true",
        retryUseBot: process.env.SCRAPING_ENGINE_RETRY_USE_BOT === "true",
      },
      windowMinutes: WINDOW_MINUTES,
      totals: {
        total,
        success,
        failed,
        successRate: total > 0 ? Math.round((success / total) * 1000) / 10 : 0,
        fallbackTotal,
        fallbackRate: total > 0 ? Math.round((fallbackTotal / total) * 1000) / 10 : 0,
        fallbackByReason,
      },
      anonymous,
      operations,
    },
  });
}

export async function GET(req: NextRequest) {
  return withRequestContextAndRateLimit(req, "read", handleGET);
}
