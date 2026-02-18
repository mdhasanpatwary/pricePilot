import { prisma } from '@/lib/prisma';

export class SearchPatternLearningService {
  static normalizeDomain(domain: string): string {
    return (domain || '').trim().toLowerCase().replace(/^www\./, '');
  }

  static normalizePattern(pattern: string): string {
    return (pattern || '').trim();
  }

  static async getBestPatternForDomain(domain: string): Promise<string | null> {
    const normalizedDomain = this.normalizeDomain(domain);
    if (!normalizedDomain) return null;

    const best = await prisma.domainSearchPattern.findFirst({
      where: { domain: normalizedDomain },
      orderBy: [{ successRate: 'desc' }, { successCount: 'desc' }, { updatedAt: 'desc' }],
      select: { pattern: true },
    });

    return best?.pattern ?? null;
  }

  static async recordAttempt(params: {
    domain: string;
    pattern: string;
    success: boolean;
    usedAt?: Date;
  }): Promise<void> {
    const domain = this.normalizeDomain(params.domain);
    const pattern = this.normalizePattern(params.pattern);
    if (!domain || !pattern) return;

    const usedAt = params.usedAt ?? new Date();

    await prisma.domainSearchPattern.upsert({
      where: { domain_pattern: { domain, pattern } },
      create: {
        domain,
        pattern,
        successCount: params.success ? 1 : 0,
        failureCount: params.success ? 0 : 1,
        successRate: params.success ? 1 : 0,
        lastUsedAt: usedAt,
      },
      update: {
        successCount: { increment: params.success ? 1 : 0 },
        failureCount: { increment: params.success ? 0 : 1 },
        lastUsedAt: usedAt,
      },
    });

    const updated = await prisma.domainSearchPattern.findUnique({
      where: { domain_pattern: { domain, pattern } },
      select: { successCount: true, failureCount: true },
    });

    if (!updated) return;

    const total = updated.successCount + updated.failureCount;
    const successRate = total > 0 ? updated.successCount / total : 0;

    await prisma.domainSearchPattern.update({
      where: { domain_pattern: { domain, pattern } },
      data: { successRate },
    });
  }
}

