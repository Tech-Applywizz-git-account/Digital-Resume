/**
 * Authorization Middleware
 *
 * Checks that the authenticated user has one of the allowed roles.
 * Must be used after the authenticate middleware.
 */
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, UnauthorizedError } from '../types/errors.js';

type Role = 'user' | 'admin';

export function authorize(...allowedRoles: Role[]) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (!req.user) {
            next(new UnauthorizedError('Authentication required'));
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            next(new ForbiddenError('Insufficient permissions'));
            return;
        }

        next();
    };
}