/**
 * Tests for graceful degradation utilities
 */

import {
    withFallback,
    safeGet,
    safeNumber,
    safePercentage,
    safeArray,
    safeString,
    isEmpty,
    truncate,
} from "@/lib/utils/graceful-degradation";

describe("Graceful Degradation Utilities", () => {
    describe("withFallback", () => {
        it("returns value when not null/undefined", () => {
            expect(withFallback(5, 0)).toBe(5);
            expect(withFallback("test", "fallback")).toBe("test");
        });

        it("returns fallback when null/undefined", () => {
            expect(withFallback(null, 0)).toBe(0);
            expect(withFallback(undefined, "fallback")).toBe("fallback");
        });
    });

    describe("safeGet", () => {
        const obj = {
            user: {
                profile: {
                    name: "John",
                },
            },
        };

        it("returns nested value when path exists", () => {
            expect(safeGet(obj, "user.profile.name", "Unknown")).toBe("John");
        });

        it("returns fallback when path does not exist", () => {
            expect(safeGet(obj, "user.profile.age", 0)).toBe(0);
            expect(safeGet(obj, "user.settings.theme", "dark")).toBe("dark");
        });

        it("returns fallback when object is null", () => {
            expect(safeGet(null, "user.name", "Unknown")).toBe("Unknown");
        });
    });

    describe("safeNumber", () => {
        it("returns number when valid", () => {
            expect(safeNumber(5)).toBe(5);
            expect(safeNumber("10")).toBe(10);
            expect(safeNumber(3.14159, 0, 2)).toBe(3.14);
        });

        it("returns fallback when invalid", () => {
            expect(safeNumber("invalid", 0)).toBe(0);
            expect(safeNumber(null, 10)).toBe(0); // null converts to 0
            expect(safeNumber(undefined, 5)).toBe(5);
            expect(safeNumber(NaN, 0)).toBe(0);
            expect(safeNumber(Infinity, 0)).toBe(0);
        });
    });

    describe("safePercentage", () => {
        it("formats percentage correctly", () => {
            expect(safePercentage(50)).toBe("50%");
            expect(safePercentage(75.5, 0, 2)).toBe("75.5%");
        });

        it("returns fallback percentage when invalid", () => {
            expect(safePercentage("invalid")).toBe("0%");
            expect(safePercentage(null, 100)).toBe("0%"); // null converts to 0
        });
    });

    describe("safeArray", () => {
        it("returns array when valid", () => {
            expect(safeArray([1, 2, 3])).toEqual([1, 2, 3]);
        });

        it("returns fallback when not array", () => {
            expect(safeArray(null, [])).toEqual([]);
            expect(safeArray("not array", [1])).toEqual([1]);
            expect(safeArray(undefined, [])).toEqual([]);
        });
    });

    describe("safeString", () => {
        it("returns string when valid", () => {
            expect(safeString("test")).toBe("test");
        });

        it("returns fallback when null/undefined", () => {
            expect(safeString(null, "fallback")).toBe("fallback");
            expect(safeString(undefined, "default")).toBe("default");
        });

        it("converts non-string values to string", () => {
            expect(safeString(123, "")).toBe("123");
            expect(safeString(true, "")).toBe("true");
        });
    });

    describe("isEmpty", () => {
        it("returns true for empty values", () => {
            expect(isEmpty(null)).toBe(true);
            expect(isEmpty(undefined)).toBe(true);
            expect(isEmpty([])).toBe(true);
            expect(isEmpty({})).toBe(true);
            expect(isEmpty("")).toBe(true);
            expect(isEmpty("   ")).toBe(true);
        });

        it("returns false for non-empty values", () => {
            expect(isEmpty([1])).toBe(false);
            expect(isEmpty({ a: 1 })).toBe(false);
            expect(isEmpty("test")).toBe(false);
            expect(isEmpty(0)).toBe(false);
        });
    });

    describe("truncate", () => {
        it("truncates long strings", () => {
            expect(truncate("This is a long string", 10)).toBe("This is...");
            expect(truncate("Short", 10)).toBe("Short");
        });

        it("uses custom ellipsis", () => {
            expect(truncate("This is a long string", 10, "…")).toBe("This is a…");
        });
    });
});
