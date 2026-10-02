/**
 * Authentication Middleware
 *
 * Verifies the Supabase JWT from the Authorization header.
 * Attaches the decoded user to req.user.
 *
 * Uses Supabase's service role to verify the token.
 * This is stateless — no database query is performed.
 */
import { Request, Response, NextFunction } from 'express';
import { getAnonClient } from '../config/database.js';
import { UnauthorizedError } from '../types/errors.js';
import { logger } from '../logger/index.js';

export interface AuthenticatedUser {
    id: string;
    email: string;
    role: 'user' | 'admin';
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

/**
 * Required authentication — rejects if no valid token.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next(new UnauthorizedError('Missing or invalid Authorization header'));
        return;
    }

    const token = authHeader.slice(7);

    getAnonClient()
        .auth.getUser(token)
        .then(({ data, error }) => {
            if (error || !data.user) {
                next(new UnauthorizedError('Invalid or expired token'));
                return;
            }

            const user = data.user;
            req.user = {
                id: user.id,
                email: user.email || '',
                role: 'user', // Will be refined by authorization middleware
            };

            next();
        })
        .catch((err) => {
            logger.error({ err }, 'Authentication error');
            next(new UnauthorizedError('Authentication failed'));
        });
}

/**
 * Optional authentication — attaches user if token is valid,
 * but does NOT reject the request if no token is present.
 */
export function authenticateOptional(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        next();
        return;
    }

    const token = authHeader.slice(7);

    getAnonClient()
        .auth.getUser(token)
        .then(({ data }) => {
            if (data?.user) {
                req.user = {
                    id: data.user.id,
                    email: data.user.email || '',
                    role: 'user',
                };
            }
            next();
        })
        .catch(() => {
            // Silently continue without user
            next();
        });
}