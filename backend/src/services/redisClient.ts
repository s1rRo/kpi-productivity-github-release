import { createClient } from 'redis';

// Redis client configuration with production optimizations
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 60000,
    lazyConnect: true,
    reconnectStrategy: (retries) => {
      // Exponential backoff with max delay of 30 seconds
      const delay = Math.min(retries * 50, 30000);
      console.log(`Redis reconnect attempt ${retries}, waiting ${delay}ms`);
      return delay;
    },
  },
  // Production optimizations
  database: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB) : 0,
  password: process.env.REDIS_PASSWORD,
  username: process.env.REDIS_USERNAME,
  // Connection pool settings for production
  isolationPoolOptions: {
    min: 2,
    max: 10,
  },
});

// Error handling
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
  // In production, you might want to send this to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // Send to monitoring service like Sentry
    console.error('Redis error in production:', err);
  }
});

redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

redisClient.on('end', () => {
  console.log('❌ Redis client disconnected');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis client reconnecting...');
});

// Connect to Redis with retry logic
export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    
    // Test connection
    await redisClient.ping();
    console.log('✅ Redis connection verified');
    
    return redisClient;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    
    // In production, Redis might be critical
    if (process.env.NODE_ENV === 'production' && process.env.REDIS_REQUIRED === 'true') {
      throw error;
    }
    
    // In development, app should work without Redis
    return null;
  }
};

// Graceful shutdown
export const disconnectRedis = async () => {
  try {
    if (redisClient.isOpen) {
      await redisClient.quit();
      console.log('✅ Redis client disconnected gracefully');
    }
  } catch (error) {
    console.error('Error disconnecting from Redis:', error);
  }
};

// Redis utility functions for production
export const redisUtils = {
  // Set with TTL
  async setWithTTL(key: string, value: string, ttlSeconds: number = 3600) {
    try {
      if (redisClient.isOpen) {
        await redisClient.setEx(key, ttlSeconds, value);
        return true;
      }
    } catch (error) {
      console.error('Redis setWithTTL error:', error);
    }
    return false;
  },

  // Get with fallback
  async get(key: string): Promise<string | null> {
    try {
      if (redisClient.isOpen) {
        return await redisClient.get(key);
      }
    } catch (error) {
      console.error('Redis get error:', error);
    }
    return null;
  },

  // Delete key
  async del(key: string): Promise<boolean> {
    try {
      if (redisClient.isOpen) {
        const result = await redisClient.del(key);
        return result > 0;
      }
    } catch (error) {
      console.error('Redis del error:', error);
    }
    return false;
  },

  // Check if key exists
  async exists(key: string): Promise<boolean> {
    try {
      if (redisClient.isOpen) {
        const result = await redisClient.exists(key);
        return result > 0;
      }
    } catch (error) {
      console.error('Redis exists error:', error);
    }
    return false;
  },

  // Increment counter
  async incr(key: string): Promise<number | null> {
    try {
      if (redisClient.isOpen) {
        return await redisClient.incr(key);
      }
    } catch (error) {
      console.error('Redis incr error:', error);
    }
    return null;
  },

  // Set hash field
  async hset(key: string, field: string, value: string): Promise<boolean> {
    try {
      if (redisClient.isOpen) {
        const result = await redisClient.hSet(key, field, value);
        return result > 0;
      }
    } catch (error) {
      console.error('Redis hset error:', error);
    }
    return false;
  },

  // Get hash field
  async hget(key: string, field: string): Promise<string | null> {
    try {
      if (redisClient.isOpen) {
        return await redisClient.hGet(key, field);
      }
    } catch (error) {
      console.error('Redis hget error:', error);
    }
    return null;
  },

  // Get all hash fields
  async hgetall(key: string): Promise<Record<string, string> | null> {
    try {
      if (redisClient.isOpen) {
        return await redisClient.hGetAll(key);
      }
    } catch (error) {
      console.error('Redis hgetall error:', error);
    }
    return null;
  },

  // Add to set
  async sadd(key: string, member: string): Promise<boolean> {
    try {
      if (redisClient.isOpen) {
        const result = await redisClient.sAdd(key, member);
        return result > 0;
      }
    } catch (error) {
      console.error('Redis sadd error:', error);
    }
    return false;
  },

  // Get set members
  async smembers(key: string): Promise<string[]> {
    try {
      if (redisClient.isOpen) {
        return await redisClient.sMembers(key);
      }
    } catch (error) {
      console.error('Redis smembers error:', error);
    }
    return [];
  },

  // Remove from set
  async srem(key: string, member: string): Promise<boolean> {
    try {
      if (redisClient.isOpen) {
        const result = await redisClient.sRem(key, member);
        return result > 0;
      }
    } catch (error) {
      console.error('Redis srem error:', error);
    }
    return false;
  },

  // Publish message
  async publish(channel: string, message: string): Promise<boolean> {
    try {
      if (redisClient.isOpen) {
        const result = await redisClient.publish(channel, message);
        return result > 0;
      }
    } catch (error) {
      console.error('Redis publish error:', error);
    }
    return false;
  },

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      if (redisClient.isOpen) {
        const result = await redisClient.ping();
        return result === 'PONG';
      }
    } catch (error) {
      console.error('Redis health check error:', error);
    }
    return false;
  }
};

export default redisClient;