import { logger } from '@/lib/logger';

export type ProxyPoolPreference = 'any' | 'residential' | 'datacenter';
export type DomainProxyMode = 'direct' | 'proxy' | 'auto';

export interface EnvProxyDefinition {
  id: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks5';
  username?: string;
  password?: string;
  provider: string;
  region?: string;
  type: ProxyPoolPreference;
  source: 'env';
}

export interface DomainProxyPolicy {
  mode: DomainProxyMode;
  pool: ProxyPoolPreference;
  stickySession: boolean;
}

export interface ProxyRuntimeConfig {
  envProxies: EnvProxyDefinition[];
  stickyTtlMs: number;
  domainPolicies: Record<string, DomainProxyPolicy>;
}

const DEFAULT_DOMAIN_POLICY: DomainProxyPolicy = {
  mode: 'auto',
  pool: 'any',
  stickySession: true,
};

function normalizeDomain(input: string): string {
  return input.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

function classifyProxyType(host: string, forceType?: ProxyPoolPreference): ProxyPoolPreference {
  if (forceType && forceType !== 'any') return forceType;
  const h = host.toLowerCase();
  if (h.includes('residential') || h.includes('resi') || h.includes('mobile') || h.includes('isp')) {
    return 'residential';
  }
  if (h.includes('dc') || h.includes('datacenter') || h.includes('server') || h.includes('cloud')) {
    return 'datacenter';
  }
  return 'any';
}

function parseProxyUrlList(raw: string | undefined, forceType?: ProxyPoolPreference): EnvProxyDefinition[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const parsed = new URL(item);
      const type = classifyProxyType(parsed.hostname, forceType);
      return {
        id: `env:${type}:${parsed.hostname}:${parsed.port || '80'}:${index}`,
        host: parsed.hostname,
        port: Number(parsed.port || (parsed.protocol === 'https:' ? 443 : 80)),
        protocol: (parsed.protocol.replace(':', '') || 'http') as 'http' | 'https' | 'socks5',
        username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        provider: process.env.SCRAPER_PROXY_PROVIDER || 'env',
        region: process.env.SCRAPER_PROXY_REGION || undefined,
        type,
        source: 'env',
      };
    });
}

function parseDomainPolicies(raw: string | undefined): Record<string, DomainProxyPolicy> {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<DomainProxyPolicy>>;
    const result: Record<string, DomainProxyPolicy> = {};
    for (const [domain, policy] of Object.entries(parsed)) {
      result[normalizeDomain(domain)] = {
        mode: policy.mode === 'direct' || policy.mode === 'proxy' ? policy.mode : 'auto',
        pool:
          policy.pool === 'residential' || policy.pool === 'datacenter'
            ? policy.pool
            : 'any',
        stickySession: policy.stickySession !== false,
      };
    }
    return result;
  } catch (error) {
    logger.error('[ProxyConfiguration] Failed to parse SCRAPER_PROXY_DOMAIN_ASSIGNMENTS JSON', {
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

function loadConfig(): ProxyRuntimeConfig {
  const envProxies = [
    ...parseProxyUrlList(process.env.SCRAPER_PROXIES, 'any'),
    ...parseProxyUrlList(process.env.SCRAPER_RESIDENTIAL_PROXIES, 'residential'),
    ...parseProxyUrlList(process.env.SCRAPER_DATACENTER_PROXIES, 'datacenter'),
  ];

  const uniqueById = new Map<string, EnvProxyDefinition>();
  for (const proxy of envProxies) {
    uniqueById.set(proxy.id, proxy);
  }

  const stickyTtlMinutes = Math.max(
    1,
    Number.parseInt(process.env.SCRAPER_PROXY_STICKY_TTL_MINUTES || '20', 10) || 20,
  );

  const config: ProxyRuntimeConfig = {
    envProxies: Array.from(uniqueById.values()),
    stickyTtlMs: stickyTtlMinutes * 60 * 1000,
    domainPolicies: parseDomainPolicies(process.env.SCRAPER_PROXY_DOMAIN_ASSIGNMENTS),
  };

  logger.info('[ProxyConfiguration] Loaded runtime proxy config', {
    envProxyCount: config.envProxies.length,
    stickyTtlMinutes,
    domainPolicyCount: Object.keys(config.domainPolicies).length,
  });

  return config;
}

function getGlobalState() {
  return globalThis as typeof globalThis & {
    __ppProxyRuntimeConfig?: ProxyRuntimeConfig;
  };
}

export function getProxyRuntimeConfig(): ProxyRuntimeConfig {
  const globalState = getGlobalState();
  if (!globalState.__ppProxyRuntimeConfig) {
    globalState.__ppProxyRuntimeConfig = loadConfig();
  }
  return globalState.__ppProxyRuntimeConfig;
}

function wildcardMatches(pattern: string, domain: string): boolean {
  if (!pattern.includes('*')) return pattern === domain;
  const normalized = normalizeDomain(pattern);
  if (normalized.startsWith('*.')) {
    const suffix = normalized.slice(1); // ".example.com"
    return domain.endsWith(suffix);
  }
  const escaped = normalized.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`).test(domain);
}

export function resolveDomainProxyPolicy(domainOrUrl: string): DomainProxyPolicy {
  const config = getProxyRuntimeConfig();
  const domain = normalizeDomain(domainOrUrl);
  const direct = config.domainPolicies[domain];
  if (direct) return direct;

  for (const [pattern, policy] of Object.entries(config.domainPolicies)) {
    if (wildcardMatches(pattern, domain)) {
      return policy;
    }
  }

  return DEFAULT_DOMAIN_POLICY;
}

