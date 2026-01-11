import { redisUtils } from './redisClient';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
  compress?: boolean; // Whether to compress the data
}

export interface CacheResult<T> {
  data: T | null;
  hit: boolean;
  key: string;
}

class CacheService {
  private defaultTTL = 3600; // 1 hour default
  private defaultPrefix = 'kpi:cache:';

  /**
   * Generate cache key with prefix and optional suffix
   */
  private generateKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || this.defaultPrefix;
    return `${finalPrefix}${key}`;
  }

  /**
   * Set data in cache with optional compression
   */
  async set<T>(
    key: string, 
    data: T, 
    options: CacheOptions = {}
  ): Promise<boolean> {
    try {
      const { ttl = this.defaultTTL, prefix, compress = false } = options;
      const cacheKey = this.generateKey(key, prefix);
      
      let serializedData = JSON.stringify(data);
      
      // Simple compression by removing whitespace for large objects
      if (compress && serializedData.length > 1000) {
        serializedData = JSON.stringify(data, null, 0);
      }
      
      return await redisUtils.setWithTTL(cacheKey, serializedData, ttl);
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get data from cache
   */
  async get<T>(
    key: string, 
    options: CacheOptions = {}
  ): Promise<CacheResult<T>> {
    try {
      const { prefix } = options;
      const cacheKey = this.generateKey(key, prefix);
      
      const cachedData = await redisUtils.get(cacheKey);
      
      if (cachedData) {
        const data = JSON.parse(cachedData) as T;
        return { data, hit: true, key: cacheKey };
      }
      
      return { data: null, hit: false, key: cacheKey };
    } catch (error) {
      console.error('Cache get error:', error);
      return { data: null, hit: false, key: this.generateKey(key, options.prefix) };
    }
  }

  /**
   * Delete data from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const { prefix } = options;
      const cacheKey = this.generateKey(key, prefix);
      return await redisUtils.del(cacheKey);
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const { prefix } = options;
      const cacheKey = this.generateKey(key, prefix);
      return await redisUtils.exists(cacheKey);
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cacheResult = await this.get<T>(key, options);
    
    if (cacheResult.hit && cacheResult.data !== null) {
      return cacheResult.data;
    }
    
    // Cache miss - fetch data and cache it
    const data = await fetchFunction();
    await this.set(key, data, options);
    
    return data;
  }

  /**
   * Cache analytics data with user-specific keys
   */
  async cacheAnalyticsReport(
    userId: string,
    reportType: string,
    startDate: Date,
    endDate: Date,
    data: any
  ): Promise<boolean> {
    const key = `analytics:${userId}:${reportType}:${startDate.toISOString().split('T')[0]}:${endDate.toISOString().split('T')[0]}`;
    return await this.set(key, data, { 
      ttl: 1800, // 30 minutes for analytics
      compress: true 
    });
  }

  /**
   * Get cached analytics report
   */
  async getCachedAnalyticsReport(
    userId: string,
    reportType: string,
    startDate: Date,
    endDate: Date
  ): Promise<CacheResult<any>> {
    const key = `analytics:${userId}:${reportType}:${startDate.toISOString().split('T')[0]}:${endDate.toISOString().split('T')[0]}`;
    return await this.get(key);
  }

  /**
   * Cache goals data for user
   */
  async cacheGoalsData(userId: string, data: any): Promise<boolean> {
    const key = `goals:${userId}`;
    return await this.set(key, data, { 
      ttl: 600, // 10 minutes for goals
      compress: true 
    });
  }

  /**
   * Get cached goals data
   */
  async getCachedGoalsData(userId: string): Promise<CacheResult<any>> {
    const key = `goals:${userId}`;
    return await this.get(key);
  }

  /**
   * Cache dashboard data
   */
  async cacheDashboardData(
    userId: string,
    type: 'year' | 'month',
    year: number,
    month?: number,
    data: any
  ): Promise<boolean> {
    const key = month 
      ? `dashboard:${userId}:${type}:${year}:${month}`
      : `dashboard:${userId}:${type}:${year}`;
    
    return await this.set(key, data, { 
      ttl: 3600, // 1 hour for dashboard data
      compress: true 
    });
  }

  /**
   * Get cached dashboard data
   */
  async getCachedDashboardData(
    userId: string,
    type: 'year' | 'month',
    year: number,
    month?: number
  ): Promise<CacheResult<any>> {
    const key = month 
      ? `dashboard:${userId}:${type}:${year}:${month}`
      : `dashboard:${userId}:${type}:${year}`;
    
    return await this.get(key);
  }

  /**
   * Invalidate user-specific cache patterns
   */
  async invalidateUserCache(userId: string, patterns: string[] = []): Promise<void> {
    try {
      const defaultPatterns = [
        `analytics:${userId}:*`,
        `goals:${userId}`,
        `dashboard:${userId}:*`
      ];
      
      const allPatterns = [...defaultPatterns, ...patterns];
      
      // Note: Redis pattern deletion would require SCAN + DEL
      // For now, we'll delete specific known keys
      const keysToDelete = [
        `goals:${userId}`,
        // Add more specific keys as needed
      ];
      
      for (const key of keysToDelete) {
        await this.delete(key);
      }
      
      console.log(`Invalidated cache for user ${userId}`);
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Cache middleware for Express routes
   */
  middleware(options: CacheOptions & { keyGenerator?: (req: any) => string } = {}) {
    return async (req: any, res: any, next: any) => {
      try {
        const { keyGenerator, ttl = 300 } = options; // 5 minutes default for middleware
        
        // Generate cache key
        const cacheKey = keyGenerator 
          ? keyGenerator(req)
          : `route:${req.method}:${req.originalUrl}:${req.userId || 'anonymous'}`;
        
        // Try to get from cache
        const cacheResult = await this.get(cacheKey, options);
        
        if (cacheResult.hit && cacheResult.data) {
          res.setHeader('X-Cache', 'HIT');
          return res.json(cacheResult.data);
        }
        
        // Cache miss - intercept response
        const originalJson = res.json;
        res.json = function(data: any) {
          // Cache the response
          cacheService.set(cacheKey, data, { ttl, ...options }).catch(console.error);
          res.setHeader('X-Cache', 'MISS');
          return originalJson.call(this, data);
        };
        
        next();
      } catch (error) {
        console.error('Cache middleware error:', error);
        next();
      }
    };
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const testKey = 'health:check';
      const testData = { timestamp: Date.now() };
      
      // Test set
      const setResult = await this.set(testKey, testData, { ttl: 60 });
      
      // Test get
      const getResult = await this.get(testKey);
      
      // Test delete
      const deleteResult = await this.delete(testKey);
      
      const redisHealth = await redisUtils.healthCheck();
      
      return {
        status: setResult && getResult.hit && deleteResult && redisHealth ? 'healthy' : 'unhealthy',
        details: {
          set: setResult,
          get: getResult.hit,
          delete: deleteResult,
          redis: redisHealth
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;