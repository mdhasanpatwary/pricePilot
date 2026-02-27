import { Redis } from 'ioredis';

/**
 * Scan a Redis instance for keys matching a pattern without blocking the server.
 * Returns all keys matching the pattern.
 */
export async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
    const results: string[] = [];
    let cursor = '0';

    // ioredis scan returns [nextCursor, keys[]]
    while (cursor !== '0') {
        const [newCursor, keys] = await (redis as any).scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;
        if (keys && keys.length) {
            results.push(...keys);
        }
    }

    return results;
}
