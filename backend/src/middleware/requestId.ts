/**
 * Request ID Middleware
 *
 * Attaches a unique identifier to each request for tracing.
 * If the client sends an X-Request-Id header, it is reused.
 */
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}

export function requestId(req: Request, res: Response, next: NextFunction): void {
    const id = (req.headers['x-request-id'] as string) || randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    next();
}