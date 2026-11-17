/**
 * Async Handler Middleware
 *
 * Wraps async controller functions to forward thrown errors
 * to the Express error handler. Eliminates try/catch boilerplate
 * in every controller.
 */
import { Request, Response, NextFunction } from 'express';

type AsyncController = (req: Request, res: Response, next: NextFunction) => Promise<void | Response>;

export function asyncHandler(fn: AsyncController): AsyncController {
    return (req: Request, res: Response, next: NextFunction) => {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };
}
