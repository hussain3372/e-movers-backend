import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class RedisService {
  private readonly logger = new Logger(RedisService.name);
  // In-memory store as fallback (replace with actual Redis client when needed)
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      // TODO: Replace with actual Redis client implementation
      // For now, using in-memory cache
      const expiresAt = ttlSeconds
        ? Date.now() + ttlSeconds * 1000
        : Infinity;

      this.cache.set(key, { value, expiresAt });

      // Clean up expired entries periodically
      this.cleanupExpired();
    } catch (error) {
      this.logger.error(`Failed to set key ${key} in Redis`, error);
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      // TODO: Replace with actual Redis client implementation
      const entry = this.cache.get(key);

      if (!entry) {
        return null;
      }

      // Check if expired
      if (entry.expiresAt < Date.now()) {
        this.cache.delete(key);
        return null;
      }

      return entry.value;
    } catch (error) {
      this.logger.error(`Failed to get key ${key} from Redis`, error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    try {
      // TODO: Replace with actual Redis client implementation
      this.cache.delete(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key} from Redis`, error);
      throw error;
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
}

