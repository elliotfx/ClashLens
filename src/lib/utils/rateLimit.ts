interface RateLimitEntry {
    count: number
    resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

interface RateLimitConfig {
    max: number // Maximum requests
    windowMs: number // Time window in milliseconds
}

/**
 * Simple in-memory rate limiter
 */
export function rateLimit(
    identifier: string,
    config: RateLimitConfig = { max: 100, windowMs: 60000 }
): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const entry = rateLimitStore.get(identifier)

    // Clean up expired entries periodically
    if (Math.random() < 0.01) {
        cleanupExpiredEntries(now)
    }

    if (!entry || entry.resetTime <= now) {
        // Create new entry or reset expired entry
        const resetTime = now + config.windowMs
        rateLimitStore.set(identifier, { count: 1, resetTime })
        return { allowed: true, remaining: config.max - 1, resetTime }
    }

    if (entry.count >= config.max) {
        return { allowed: false, remaining: 0, resetTime: entry.resetTime }
    }

    entry.count++
    return { allowed: true, remaining: config.max - entry.count, resetTime: entry.resetTime }
}

function cleanupExpiredEntries(now: number) {
    for (const [key, entry] of rateLimitStore.entries()) {
        if (entry.resetTime <= now) {
            rateLimitStore.delete(key)
        }
    }
}

/**
 * Rate limit middleware for API routes
 */
export function createRateLimiter(config?: RateLimitConfig) {
    return (identifier: string) => rateLimit(identifier, config)
}
