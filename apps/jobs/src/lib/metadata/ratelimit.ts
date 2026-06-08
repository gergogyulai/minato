import { RateLimiter } from "limiter";

export const tmdbRateLimiter = new RateLimiter({
	tokensPerInterval: 50,
	interval: "second",
});

export const anilistRateLimiter = new RateLimiter({
	tokensPerInterval: 90,
	interval: "minute",
});
