/**
 * Request Logger Middleware
 *
 * Logs every request with duration, status code, and trace ID.
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger/index.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    res.on('finish', () => {
        logger.info({
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: Date.now() - start,
            requestId: req.requestId,
            userId: req.user?.id,
        }, 'Request completed');
    });

    next();
}