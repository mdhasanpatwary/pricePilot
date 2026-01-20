import { prisma } from "@/lib/prisma";

export class SystemConfigService {
  /**
   * Get a config value by key, with a fallback
   */
  static async get<T>(key: string, fallback: T): Promise<T> {
    try {
      const config = await prisma.systemConfig.findUnique({
        where: { key },
      });

      if (!config) return fallback;

      const value = config.value;

      if (config.type === "number") {
        return parseFloat(value) as unknown as T;
      }

      if (config.type === "boolean") {
        return (value === "true") as unknown as T;
      }

      if (config.type === "json") {
        try {
          return JSON.parse(value) as unknown as T;
        } catch {
          return fallback;
        }
      }

      return value as unknown as T;
    } catch (error) {
      console.error(`[SystemConfigService] Error fetching key: ${key}`, error);
      return fallback;
    }
  }

  /**
   * Get multiple configs at once
   */
  static async getMany(keys: string[]): Promise<Record<string, any>> {
    try {
      const configs = await prisma.systemConfig.findMany({
        where: { key: { in: keys } },
      });

      const result: Record<string, any> = {};
      configs.forEach((c: any) => {
        let val: any = c.value;

        if (c.type === "number") val = parseFloat(c.value);
        if (c.type === "boolean") val = c.value === "true";
        if (c.type === "json") {
          try {
            val = JSON.parse(c.value);
          } catch {
            val = c.value;
          }
        }
        result[c.key] = val;
      });

      return result;
    } catch (error) {
      return {};
    }
  }
}
