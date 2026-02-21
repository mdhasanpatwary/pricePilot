import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getCachedSession } from '@/lib/auth/cached-session';
import { withRequestContextAndRateLimit } from '@/lib/middleware/with-request-context';
import { recordAuditLog, getIpAddress } from '@/lib/audit';
import { encryptForStorage, isEncryptedString } from '@/lib/services/encryption/field-encryption';
import { getAdvancedAccessReadiness } from '@/lib/services/advanced-access';

const updateAdvancedAccessSchema = z.object({
  proxyEnabled: z.boolean(),
  proxyProtocol: z.enum(['http', 'https', 'socks5']).optional(),
  proxyHost: z.string().trim().max(255).optional(),
  proxyPort: z.number().int().min(1).max(65535).optional(),
  proxyUsername: z.string().trim().max(255).optional(),
  proxyPassword: z.string().trim().max(1024).optional(),
  captchaEnabled: z.boolean(),
  captchaProvider: z.string().trim().max(64).optional(),
  captchaApiKey: z.string().trim().max(1024).optional(),
});

async function handleGET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { id: siteId } = await params;

  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      tenantId,
      type: 'COMPETITOR',
    },
    select: {
      id: true,
      isAdvancedProtected: true,
      advancedAccessStatus: true,
      advancedAccessReason: true,
      advancedAccessRequiredAt: true,
      tenantProxyEnabled: true,
      tenantProxyProtocol: true,
      tenantProxyHost: true,
      tenantProxyPort: true,
      tenantProxyUsername: true,
      tenantProxyPasswordEncrypted: true,
      tenantCaptchaEnabled: true,
      tenantCaptchaProvider: true,
      tenantCaptchaApiKeyEncrypted: true,
    },
  });

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const readiness = getAdvancedAccessReadiness(site);

  return NextResponse.json({
    success: true,
    data: {
      siteId: site.id,
      isAdvancedProtected: site.isAdvancedProtected,
      status: site.advancedAccessStatus,
      reason: site.advancedAccessReason,
      requiredAt: site.advancedAccessRequiredAt,
      readiness,
      proxy: {
        enabled: site.tenantProxyEnabled,
        protocol: site.tenantProxyProtocol,
        host: site.tenantProxyHost,
        port: site.tenantProxyPort,
        username: site.tenantProxyUsername,
        hasPassword: Boolean(site.tenantProxyPasswordEncrypted),
      },
      captcha: {
        enabled: site.tenantCaptchaEnabled,
        provider: site.tenantCaptchaProvider,
        hasApiKey: Boolean(site.tenantCaptchaApiKeyEncrypted),
      },
    },
  });
}

async function handlePUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCachedSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.user.tenantId;
  const { id: siteId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = updateAdvancedAccessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid advanced access payload' }, { status: 400 });
  }

  const input = parsed.data;

  const site = await prisma.site.findFirst({
    where: {
      id: siteId,
      tenantId,
      type: 'COMPETITOR',
    },
    select: {
      id: true,
      baseUrl: true,
      tenantProxyPasswordEncrypted: true,
      tenantCaptchaApiKeyEncrypted: true,
    },
  });

  if (!site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  const nextProxyPasswordEncrypted =
    typeof input.proxyPassword === 'string' && input.proxyPassword.length > 0
      ? isEncryptedString(input.proxyPassword)
        ? input.proxyPassword
        : encryptForStorage(input.proxyPassword)
      : site.tenantProxyPasswordEncrypted;

  const nextCaptchaApiKeyEncrypted =
    typeof input.captchaApiKey === 'string' && input.captchaApiKey.length > 0
      ? isEncryptedString(input.captchaApiKey)
        ? input.captchaApiKey
        : encryptForStorage(input.captchaApiKey)
      : site.tenantCaptchaApiKeyEncrypted;

  const proxyHost = input.proxyEnabled ? (input.proxyHost || null) : null;
  const proxyPort = input.proxyEnabled ? (input.proxyPort ?? null) : null;
  const proxyProtocol = input.proxyEnabled ? (input.proxyProtocol || 'http') : null;

  const captchaProvider = input.captchaEnabled
    ? (input.captchaProvider || '2captcha')
    : null;

  const proxyConfigured = Boolean(input.proxyEnabled && proxyHost && proxyPort);
  const captchaConfigured = Boolean(input.captchaEnabled && captchaProvider && nextCaptchaApiKeyEncrypted);
  const nextStatus = proxyConfigured && captchaConfigured ? 'READY' : 'REQUIRES_SETUP';

  await prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id: site.id },
      data: {
        isAdvancedProtected: true,
        lastSecurityBlockAt: new Date(),
        advancedAccessStatus: nextStatus,
        advancedAccessRequiredAt: nextStatus === 'REQUIRES_SETUP' ? new Date() : undefined,
        advancedAccessReason:
          nextStatus === 'READY'
            ? 'Tenant configured proxy and captcha solver for advanced protected site'
            : 'Advanced anti-bot protection requires proxy and captcha solver setup',
        tenantProxyEnabled: input.proxyEnabled,
        tenantProxyProtocol: proxyProtocol,
        tenantProxyHost: proxyHost,
        tenantProxyPort: proxyPort,
        tenantProxyUsername: input.proxyEnabled ? input.proxyUsername || null : null,
        tenantProxyPasswordEncrypted: input.proxyEnabled
          ? nextProxyPasswordEncrypted || null
          : null,
        tenantCaptchaEnabled: input.captchaEnabled,
        tenantCaptchaProvider: captchaProvider,
        tenantCaptchaApiKeyEncrypted: input.captchaEnabled
          ? nextCaptchaApiKeyEncrypted || null
          : null,
      },
    });

    await tx.scrapingConfig.upsert({
      where: { competitorWebsiteId: site.id },
      create: {
        tenantId,
        competitorWebsiteId: site.id,
        preferredStrategy: 'headless_with_proxy',
        requiresJavascript: true,
        proxyRequired: input.proxyEnabled,
        baseDelayMs: 2000,
        maxDelayMs: 300000,
        backoffMultiplier: 2,
        maxRetries: 3,
        timeoutMs: 30000,
        priceSelectors: ['.price', "[itemprop='price']", '.product-price'],
      },
      update: {
        proxyRequired: input.proxyEnabled,
        requiresJavascript: true,
      },
    });
  });

  await recordAuditLog({
    tenantId,
    userId: session.user.id,
    userEmail: session.user.email || 'unknown',
    action: 'UPDATE_ADVANCED_ACCESS_CONFIG',
    entityId: site.id,
    ipAddress: getIpAddress(req),
    details: {
      siteBaseUrl: site.baseUrl,
      proxyEnabled: input.proxyEnabled,
      proxyHost,
      proxyPort,
      captchaEnabled: input.captchaEnabled,
      captchaProvider,
      status: nextStatus,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      siteId: site.id,
      status: nextStatus,
      proxyConfigured,
      captchaConfigured,
    },
    message:
      nextStatus === 'READY'
        ? 'Advanced access is ready. You can continue sync now.'
        : 'Advanced access saved. Complete both proxy and captcha setup to continue sync.',
  });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withRequestContextAndRateLimit(req, 'read', () => handleGET(req, context));
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  return withRequestContextAndRateLimit(req, 'write', () => handlePUT(req, context));
}
