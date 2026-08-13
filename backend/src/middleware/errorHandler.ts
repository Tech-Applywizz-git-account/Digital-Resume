/**
 * Global Error Handler Middleware
 *
 * Catches all errors thrown in the application and returns
 * a consistent JSON response structure.
 */
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types/errors.js';
import { logger } from '../logger/index.js';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof AppError) {
        logger.warn({ err, requestId: req.requestId }, 'Application error');
        res.status(err.statusCode).json({
            success: false,
            error: {
                code: err.code,
                message: err.message,
                details: err.details,
            },
            requestId: req.requestId,
        });
        return;
    }

    // Unexpected error — don't leak details in production
    logger.error({ err, requestId: req.requestId }, 'Unexpected error');
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        },
        requestId: req.requestId,
    });
}