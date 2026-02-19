import { Redis, type RedisOptions } from "ioredis";

const getRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const preferLocalInDev = process.env.REDIS_PREFER_LOCAL_IN_DEV !== "false";
  if (process.env.NODE_ENV !== "production" && preferLocalInDev) {
    return "redis://localhost:6379";
  }

  if (process.env.NODE_ENV === "production") {
    console.warn("[Redis] REDIS_URL is not set in production. Defaulting to redis://localhost:6379");
  }

  return "redis://localhost:6379";
};

const REDIS_URL = getRedisUrl();
const SHOULD_LOG_REDIS_CONNECT = process.env.REDIS_LOG_CONNECTIONS === "true";
const MAX_RETRY_ATTEMPTS = process.env.NODE_ENV === "test" ? 3 : 10;

type RedisRole = "base" | "publisher" | "subscriber";

type RedisGlobalState = {
  __ppRedisProcessInstanceId?: string;
  __ppRedisSingletons?: Partial<Record<RedisRole, Redis>>;
  __ppRedisConnectionAttempts?: Partial<Record<RedisRole, number>>;
  __ppRedisHasLoggedConnect?: Partial<Record<RedisRole, boolean>>;
};

const redisGlobal = globalThis as typeof globalThis & RedisGlobalState;

const getProcessInstanceId = (): string => {
  if (!redisGlobal.__ppRedisProcessInstanceId) {
    redisGlobal.__ppRedisProcessInstanceId = `redis-proc-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return redisGlobal.__ppRedisProcessInstanceId;
};

const getSingletonMap = (): Partial<Record<RedisRole, Redis>> => {
  if (!redisGlobal.__ppRedisSingletons) {
    redisGlobal.__ppRedisSingletons = {};
  }
  return redisGlobal.__ppRedisSingletons;
};

const getAttemptMap = (): Partial<Record<RedisRole, number>> => {
  if (!redisGlobal.__ppRedisConnectionAttempts) {
    redisGlobal.__ppRedisConnectionAttempts = {};
  }
  return redisGlobal.__ppRedisConnectionAttempts;
};

const getConnectLogMap = (): Partial<Record<RedisRole, boolean>> => {
  if (!redisGlobal.__ppRedisHasLoggedConnect) {
    redisGlobal.__ppRedisHasLoggedConnect = {};
  }
  return redisGlobal.__ppRedisHasLoggedConnect;
};

const createRedisOptions = (role: RedisRole): RedisOptions => ({
  maxRetriesPerRequest: null,
  connectTimeout: 5000,
  lazyConnect: true,
  keepAlive: 30000,
  family: 4,
  enableAutoPipelining: true,
  retryStrategy(times) {
    const attempts = getAttemptMap();
    attempts[role] = times;

    if (process.env.NODE_ENV === "test") {
      return null;
    }

    if (times > MAX_RETRY_ATTEMPTS) {
      console.error(`❌ Redis (${role}) failed after ${MAX_RETRY_ATTEMPTS} attempts. Giving up.`);
      return null;
    }

    const delay = Math.min(times * 100, 3000);
    console.log(`🔄 Redis (${role}) retry ${times}/${MAX_RETRY_ATTEMPTS} in ${delay}ms...`);
    return delay;
  },
  reconnectOnError(err) {
    return err.message.includes("READONLY");
  },
});

const attachClientEvents = (client: Redis, role: RedisRole): void => {
  client.on("error", (err: any) => {
    if (process.env.NODE_ENV === "test") {
      return;
    }

    if (err.code === "ECONNREFUSED") {
      console.error(`❌ Redis (${role}) connection refused. Is Redis running?`);
    } else if (err.code === "ENOTFOUND") {
      console.error(`❌ Redis (${role}) host not found. Check REDIS_URL.`);
    } else if (err.message.includes("WRONGPASS") || err.message.includes("NOAUTH")) {
      console.error(`❌ Redis (${role}) authentication failed. Check REDIS_URL credentials.`);
    } else {
      console.error(`❌ Redis (${role}) error:`, err.message);
    }
  });

  client.on("connect", () => {
    const attempts = getAttemptMap();
    attempts[role] = 0;

    if (process.env.NODE_ENV !== "test" && SHOULD_LOG_REDIS_CONNECT) {
      const logged = getConnectLogMap();
      if (!logged[role]) {
        console.log(`✅ Redis (${role}) connected successfully`);
        logged[role] = true;
      }
    }
  });

  client.on("reconnecting", () => {
    if (process.env.NODE_ENV !== "test") {
      console.log(`🔄 Redis (${role}) reconnecting...`);
    }
  });
};

const createRedisClient = (role: RedisRole): Redis => {
  const client = new Redis(REDIS_URL, createRedisOptions(role));
  attachClientEvents(client, role);
  console.log("[RedisSingleton] Created Redis client", {
    role,
    processInstanceId: getProcessInstanceId(),
    pid: process.pid,
  });
  return client;
};

const getOrCreateRedisClient = (role: RedisRole): Redis => {
  // Use a single command client for both base operations and publishing.
  // Subscriber must remain a dedicated connection because SUBSCRIBE mode blocks normal commands.
  const normalizedRole: RedisRole = role === "publisher" ? "base" : role;

  const map = getSingletonMap();
  const existing = map[normalizedRole];
  if (existing && existing.status !== "end") {
    if (role === "publisher" && !map.publisher) {
      map.publisher = existing;
    }
    return existing;
  }

  const client = createRedisClient(normalizedRole);
  map[normalizedRole] = client;
  if (role === "publisher") {
    map.publisher = client;
  }
  return client;
};

export const getRedisConnection = (): Redis => getOrCreateRedisClient("base");

export const getRedisPublisher = (): Redis => getOrCreateRedisClient("publisher");

export const getRedisSubscriber = (): Redis => getOrCreateRedisClient("subscriber");

export const getRedisProcessInstanceId = (): string => getProcessInstanceId();

export const disconnectRedis = async (): Promise<void> => {
  const map = getSingletonMap();
  const clients = [...new Set(Object.values(map).filter((client): client is Redis => Boolean(client)))];

  if (clients.length === 0) {
    return;
  }

  await Promise.all(
    clients.map(async (client) => {
      try {
        if (client.status !== "end") {
          await client.quit();
        }
      } catch {
        // Ignore disconnect errors during teardown.
      }
    }),
  );

  redisGlobal.__ppRedisSingletons = {};
};
