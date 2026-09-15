import { Redis } from "ioredis";

let redis: Redis | null = null;

try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
    redis.on('error', (err) => {
      console.warn('Redis connection error (rate limiting disabled):', err.message);
      redis = null;
    });
  } else {
    console.warn('REDIS_URL not set - rate limiting disabled');
  }
} catch (error) {
  console.warn('Redis initialization failed - rate limiting disabled:', error);
  redis = null;
}

const RATE_LIMITS = {
  free: parseInt(process.env.RATE_LIMIT_FREE || "100"),
  pro: parseInt(process.env.RATE_LIMIT_PRO || "1000"),
  enterprise: parseInt(process.env.RATE_LIMIT_ENTERPRISE || "10000"),
};

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export async function checkRateLimit(
  userId: string,
  tier: "free" | "pro" | "enterprise" = "free"
): Promise<RateLimitResult> {
  const limit = RATE_LIMITS[tier];
  const key = `ratelimit:${userId}:${Date.now().toString().slice(0, -5)}`; // Per hour
  
  // If Redis is not available, fail open (allow request)
  if (!redis) {
    return {
      success: true,
      limit,
      remaining: limit,
      reset: Date.now() + 3600000,
    };
  }
  
  try {
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, 3600); // 1 hour
    }
    
    const ttl = await redis.ttl(key);
    const reset = Date.now() + ttl * 1000;
    
    return {
      success: current <= limit,
      limit,
      remaining: Math.max(0, limit - current),
      reset,
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    // Fail open - allow request if Redis is down
    return {
      success: true,
      limit,
      remaining: limit,
      reset: Date.now() + 3600000,
    };
  }
}

export async function resetRateLimit(userId: string): Promise<void> {
  if (!redis) return;
  
  try {
    const pattern = `ratelimit:${userId}:*`;
    const keys = await redis.keys(pattern);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (error) {
    console.error("Rate limit reset error:", error);
  }
}



