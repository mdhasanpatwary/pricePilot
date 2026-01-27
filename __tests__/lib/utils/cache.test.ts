/**
 * Tests for caching utilities
 */

import { Cache } from "@/lib/utils/cache";

describe("Cache", () => {
    let cache: Cache<string>;

    beforeEach(() => {
        cache = new Cache({ ttl: 1000, maxSize: 3 });
    });

    describe("get and set", () => {
        it("should store and retrieve values", () => {
            cache.set("key1", "value1");
            expect(cache.get("key1")).toBe("value1");
        });

        it("should return null for non-existent keys", () => {
            expect(cache.get("nonexistent")).toBeNull();
        });

        it("should overwrite existing values", () => {
            cache.set("key1", "value1");
            cache.set("key1", "value2");
            expect(cache.get("key1")).toBe("value2");
        });
    });

    describe("TTL (Time To Live)", () => {
        it("should expire entries after TTL", () => {
            jest.useFakeTimers();

            cache.set("key1", "value1");
            expect(cache.get("key1")).toBe("value1");

            // Fast-forward time past TTL
            jest.advanceTimersByTime(1001);

            expect(cache.get("key1")).toBeNull();

            jest.useRealTimers();
        });

        it("should support custom TTL per entry", () => {
            jest.useFakeTimers();

            cache.set("key1", "value1", 500);
            cache.set("key2", "value2", 2000);

            // After 600ms, key1 should be expired but key2 should still exist
            jest.advanceTimersByTime(600);

            expect(cache.get("key1")).toBeNull();
            expect(cache.get("key2")).toBe("value2");

            jest.useRealTimers();
        });
    });

    describe("maxSize", () => {
        it("should enforce maximum cache size", () => {
            cache.set("key1", "value1");
            cache.set("key2", "value2");
            cache.set("key3", "value3");
            cache.set("key4", "value4"); // Should evict key1

            expect(cache.get("key1")).toBeNull();
            expect(cache.get("key2")).toBe("value2");
            expect(cache.get("key3")).toBe("value3");
            expect(cache.get("key4")).toBe("value4");
        });
    });

    describe("has", () => {
        it("should return true for existing valid keys", () => {
            cache.set("key1", "value1");
            expect(cache.has("key1")).toBe(true);
        });

        it("should return false for non-existent keys", () => {
            expect(cache.has("nonexistent")).toBe(false);
        });

        it("should return false for expired keys", () => {
            jest.useFakeTimers();

            cache.set("key1", "value1");
            expect(cache.has("key1")).toBe(true);

            jest.advanceTimersByTime(1001);

            expect(cache.has("key1")).toBe(false);

            jest.useRealTimers();
        });
    });

    describe("delete", () => {
        it("should delete specific keys", () => {
            cache.set("key1", "value1");
            cache.set("key2", "value2");

            cache.delete("key1");

            expect(cache.get("key1")).toBeNull();
            expect(cache.get("key2")).toBe("value2");
        });
    });

    describe("clear", () => {
        it("should clear all entries", () => {
            cache.set("key1", "value1");
            cache.set("key2", "value2");
            cache.set("key3", "value3");

            cache.clear();

            expect(cache.get("key1")).toBeNull();
            expect(cache.get("key2")).toBeNull();
            expect(cache.get("key3")).toBeNull();
            expect(cache.size()).toBe(0);
        });
    });

    describe("size", () => {
        it("should return correct cache size", () => {
            expect(cache.size()).toBe(0);

            cache.set("key1", "value1");
            expect(cache.size()).toBe(1);

            cache.set("key2", "value2");
            expect(cache.size()).toBe(2);

            cache.delete("key1");
            expect(cache.size()).toBe(1);
        });
    });

    describe("getOrSet", () => {
        it("should return cached value if exists", async () => {
            cache.set("key1", "cached");

            const factory = jest.fn(() => "fresh");
            const result = await cache.getOrSet("key1", factory);

            expect(result).toBe("cached");
            expect(factory).not.toHaveBeenCalled();
        });

        it("should call factory and cache result if not exists", async () => {
            const factory = jest.fn(() => "fresh");
            const result = await cache.getOrSet("key1", factory);

            expect(result).toBe("fresh");
            expect(factory).toHaveBeenCalledTimes(1);
            expect(cache.get("key1")).toBe("fresh");
        });

        it("should support async factories", async () => {
            const factory = jest.fn(async () => {
                return new Promise<string>((resolve) => {
                    setTimeout(() => resolve("async-value"), 10);
                });
            });

            const result = await cache.getOrSet("key1", factory);

            expect(result).toBe("async-value");
            expect(cache.get("key1")).toBe("async-value");
        });
    });

    describe("cleanup", () => {
        it("should remove expired entries", () => {
            jest.useFakeTimers();

            cache.set("key1", "value1", 500);
            cache.set("key2", "value2", 2000);
            cache.set("key3", "value3", 2000);

            jest.advanceTimersByTime(600);

            cache.cleanup();

            expect(cache.get("key1")).toBeNull();
            expect(cache.get("key2")).toBe("value2");
            expect(cache.get("key3")).toBe("value3");
            expect(cache.size()).toBe(2);

            jest.useRealTimers();
        });

        it("should not affect valid entries", () => {
            cache.set("key1", "value1");
            cache.set("key2", "value2");

            cache.cleanup();

            expect(cache.get("key1")).toBe("value1");
            expect(cache.get("key2")).toBe("value2");
            expect(cache.size()).toBe(2);
        });
    });
});
