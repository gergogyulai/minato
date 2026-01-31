class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second

  constructor(maxTokens: number, refillRate: number) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async waitForToken(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time needed
    const tokensNeeded = 1 - this.tokens;
    const waitTime = (tokensNeeded / this.refillRate) * 1000; // milliseconds
    
    console.log(`[Rate Limiter] Waiting ${Math.ceil(waitTime)}ms for token...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    this.tokens = 0;
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

// TMDB allows 50 requests per second, but we'll be conservative
export const tmdbRateLimiter = new RateLimiter(20, 2); // 20 tokens max, 2 per second
