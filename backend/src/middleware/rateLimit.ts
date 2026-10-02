/**
 * Rate Limiter Middleware
 *
 * Simple in-memory rate limiter. For production, replace with
 * a Redis-backed implementation (e.g., express-rate-limit with Redis store).
 */
import { Request, Response, NextFunction } from 'express';
import { environment } from '../config/environment.js';
import { RateLimitError } from '../types/errors.js';

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
        if (entry.resetAt <= now) {
            store.delete(key);
        }
    }
}, 60_000);

export function rateLimit(req: Request, _res: Response, next: NextFunction): void {
    const key = req.user?.id || req.ip || 'unknown';
    const now = Date.now();
    const windowMs = environment.rateLimitWindowMs;
    const maxRequests = environment.rateLimitMax;

    let entry = store.get(key);

    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        store.set(key, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
        next(new RateLimitError());
        return;
    }

    next();
}