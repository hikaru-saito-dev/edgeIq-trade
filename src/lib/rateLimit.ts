type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export class SlidingWindowRateLimiter {
  private store = new Map<string, number[]>();

  constructor(private limit: number, private windowMs: number) {}

  tryConsume(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = (this.store.get(key) || []).filter((ts) => ts > windowStart);

    if (timestamps.length >= this.limit) {
      const retryAfterMs = timestamps[0] + this.windowMs - now;
      this.store.set(key, timestamps);
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);
    return { allowed: true };
  }
}


