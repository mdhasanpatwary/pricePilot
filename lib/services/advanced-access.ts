import { prisma } from '@/lib/prisma';

export type AdvancedAccessStatus = 'NOT_REQUIRED' | 'REQUIRES_SETUP' | 'READY';

export interface AdvancedAccessReadiness {
  status: AdvancedAccessStatus;
  proxyConfigured: boolean;
  captchaConfigured: boolean;
  missingRequirements: Array<'proxy' | 'captcha'>;
}

interface SiteAdvancedFields {
  advancedAccessStatus: string | null;
  tenantProxyEnabled: boolean;
  tenantProxyHost: string | null;
  tenantProxyPort: number | null;
  tenantCaptchaEnabled: boolean;
  tenantCaptchaProvider: string | null;
  tenantCaptchaApiKeyEncrypted: string | null;
}

let advancedAccessColumnsSupported: boolean | null = null;
let advancedAccessSupportProbePromise: Promise<boolean> | null = null;

function isMissingColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('does not exist in the current database') || message.includes('P2022');
}

function markAdvancedColumnsUnavailable() {
  advancedAccessColumnsSupported = false;
}

function markAdvancedColumnsAvailable() {
  if (advancedAccessColumnsSupported !== false) {
    advancedAccessColumnsSupported = true;
  }
}

async function ensureAdvancedAccessSupportDetected(): Promise<boolean> {
  if (advancedAccessColumnsSupported !== null) {
    return advancedAccessColumnsSupported;
  }

  if (!advancedAccessSupportProbePromise) {
    advancedAccessSupportProbePromise = (async () => {
      try {
        const result = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN ('Site', 'site')
              AND column_name = 'advancedAccessStatus'
          ) AS "exists"
        `);
        if (result?.[0]?.exists) {
          markAdvancedColumnsAvailable();
        } else {
          markAdvancedColumnsUnavailable();
        }
      } catch (error) {
        // If schema introspection fails unexpectedly, fall back to legacy-safe mode.
        markAdvancedColumnsUnavailable();
      }
      return advancedAccessColumnsSupported === true;
    })();
  }

  try {
    return await advancedAccessSupportProbePromise;
  } finally {
    advancedAccessSupportProbePromise = null;
  }
}

export function getAdvancedAccessReadiness(site: SiteAdvancedFields): AdvancedAccessReadiness {
  const status = (site.advancedAccessStatus || 'NOT_REQUIRED') as AdvancedAccessStatus;
  const proxyConfigured = Boolean(
    site.tenantProxyEnabled &&
      site.tenantProxyHost &&
      site.tenantProxyPort,
  );
  const captchaConfigured = Boolean(
    site.tenantCaptchaEnabled &&
      site.tenantCaptchaProvider &&
      site.tenantCaptchaApiKeyEncrypted,
  );

  const missingRequirements: Array<'proxy' | 'captcha'> = [];
  if (!proxyConfigured) missingRequirements.push('proxy');
  if (!captchaConfigured) missingRequirements.push('captcha');

  return {
    status,
    proxyConfigured,
    captchaConfigured,
    missingRequirements,
  };
}

export async function markSiteAsAdvancedProtected(params: {
  siteId: string;
  tenantId: string;
  reason?: string;
}): Promise<AdvancedAccessReadiness | null> {
  const supportsAdvancedColumns = await ensureAdvancedAccessSupportDetected();
  if (!supportsAdvancedColumns) {
    await prisma.site
      .updateMany({
        where: { id: params.siteId },
        data: {
          isAdvancedProtected: true,
          lastSecurityBlockAt: new Date(),
        },
      })
      .catch(() => null);
    return null;
  }

  let site:
    | (SiteAdvancedFields & {
        id: string;
      })
    | null = null;

  try {
    site = await prisma.site.findFirst({
      where: {
        id: params.siteId,
        tenantId: params.tenantId,
        type: 'COMPETITOR',
      },
      select: {
        id: true,
        advancedAccessStatus: true,
        tenantProxyEnabled: true,
        tenantProxyHost: true,
        tenantProxyPort: true,
        tenantCaptchaEnabled: true,
        tenantCaptchaProvider: true,
        tenantCaptchaApiKeyEncrypted: true,
      },
    });
    markAdvancedColumnsAvailable();
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    markAdvancedColumnsUnavailable();

    await prisma.site
      .updateMany({
        where: { id: params.siteId },
        data: {
          isAdvancedProtected: true,
          lastSecurityBlockAt: new Date(),
        },
      })
      .catch(() => null);

    return null;
  }

  if (!site) return null;

  const readiness = getAdvancedAccessReadiness(site);
  const nextStatus: AdvancedAccessStatus =
    readiness.proxyConfigured && readiness.captchaConfigured
      ? 'READY'
      : 'REQUIRES_SETUP';

  await prisma.site.updateMany({
    where: { id: site.id },
    data: {
      isAdvancedProtected: true,
      lastSecurityBlockAt: new Date(),
      advancedAccessStatus: nextStatus,
      advancedAccessRequiredAt:
        nextStatus === 'REQUIRES_SETUP' ? new Date() : undefined,
      advancedAccessReason: params.reason || 'Advanced anti-bot protection detected',
    },
  });

  return {
    ...readiness,
    status: nextStatus,
  };
}

export async function shouldBlockSyncForAdvancedAccess(params: {
  siteId: string;
  tenantId: string;
}): Promise<
  | {
      block: true;
      message: string;
      missingRequirements: Array<'proxy' | 'captcha'>;
    }
  | { block: false }
> {
  const supportsAdvancedColumns = await ensureAdvancedAccessSupportDetected();
  if (!supportsAdvancedColumns) {
    const legacySite = await prisma.site.findFirst({
      where: {
        id: params.siteId,
        tenantId: params.tenantId,
        type: 'COMPETITOR',
      },
      select: {
        isAdvancedProtected: true,
      },
    });

    if (!legacySite?.isAdvancedProtected) {
      return { block: false };
    }

    return {
      block: true,
      message:
        'This site uses advanced anti-bot protection. Add proxy and captcha solver service to continue syncing.',
      missingRequirements: ['proxy', 'captcha'],
    };
  }

  let site:
    | (SiteAdvancedFields & {
        id: string;
        isAdvancedProtected: boolean;
      })
    | null = null;

  try {
    site = await prisma.site.findFirst({
      where: {
        id: params.siteId,
        tenantId: params.tenantId,
        type: 'COMPETITOR',
      },
      select: {
        id: true,
        isAdvancedProtected: true,
        advancedAccessStatus: true,
        tenantProxyEnabled: true,
        tenantProxyHost: true,
        tenantProxyPort: true,
        tenantCaptchaEnabled: true,
        tenantCaptchaProvider: true,
        tenantCaptchaApiKeyEncrypted: true,
      },
    });
    markAdvancedColumnsAvailable();
  } catch (error) {
    if (!isMissingColumnError(error)) throw error;
    markAdvancedColumnsUnavailable();

    // Backward-compatible fallback for tenants running before advanced-access migration.
    // If site is already marked as advanced-protected, we still enforce a hard gate.
    const legacySite = await prisma.site.findFirst({
      where: {
        id: params.siteId,
        tenantId: params.tenantId,
        type: 'COMPETITOR',
      },
      select: {
        id: true,
        isAdvancedProtected: true,
      },
    });

    if (!legacySite?.isAdvancedProtected) {
      return { block: false };
    }

    return {
      block: true,
      message:
        'This site uses advanced anti-bot protection. Add proxy and captcha solver service to continue syncing.',
      missingRequirements: ['proxy', 'captcha'],
    };
  }

  if (!site) {
    return { block: false };
  }

  const readiness = getAdvancedAccessReadiness(site);
  const forceProtectedGate = site.isAdvancedProtected || readiness.status !== 'NOT_REQUIRED';

  if (!forceProtectedGate) {
    return { block: false };
  }

  if (readiness.proxyConfigured && readiness.captchaConfigured) {
    if (readiness.status !== 'READY') {
      await prisma.site.updateMany({
        where: { id: site.id },
        data: { advancedAccessStatus: 'READY' },
      });
    }
    return { block: false };
  }

  if (readiness.status !== 'REQUIRES_SETUP') {
    await prisma.site.updateMany({
      where: { id: site.id },
      data: {
        advancedAccessStatus: 'REQUIRES_SETUP',
        advancedAccessRequiredAt: new Date(),
      },
    });
  }

  return {
    block: true,
    message:
      'This site uses advanced anti-bot protection. Add proxy and captcha solver service to continue syncing.',
    missingRequirements: readiness.missingRequirements,
  };
}
