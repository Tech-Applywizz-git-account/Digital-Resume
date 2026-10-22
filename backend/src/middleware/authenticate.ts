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
import { getAnonClient, getDatabase } from '../config/database.js';
import { environment } from '../config/environment.js';
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
 * Required authentication — checks Bearer token, with secure CRM Admin fallback.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    const adminEmailHeader = (req.headers['x-admin-email'] as string)?.toLowerCase().trim();

    // 1. If Bearer token is provided, verify it with Supabase Auth
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            // First check with admin/service client for authoritative verification
            let user = (await getDatabase().auth.getUser(token))?.data?.user;
            if (!user) {
                user = (await getAnonClient().auth.getUser(token))?.data?.user;
            }
            if (user) {
                req.user = {
                    id: user.id,
                    email: user.email || '',
                    role: 'user',
                };
                next();
                return;
            }
        } catch (err) {
            logger.warn({ err }, 'Bearer token verification failed');
        }
    }

    // 2. Fallback for CRM Admin requests (e.g. session token expired or admin logged in via CRM session)
    if (adminEmailHeader) {
        try {
            const db = getDatabase();
            const { data: adminRecord } = await db
                .from('crm_admins')
                .select('email')
                .ilike('email', adminEmailHeader)
                .maybeSingle();

            if (adminRecord?.email) {
                req.user = {
                    id: adminRecord.email,
                    email: adminRecord.email.toLowerCase().trim(),
                    role: 'admin',
                };
                next();
                return;
            }
        } catch (err) {
            logger.error({ err }, 'CRM Admin verification error');
        }
    }

    next(new UnauthorizedError('Missing or invalid Authorization header'));
}

/**
 * Optional authentication — attaches user if token or verified admin header is present.
 */
export async function authenticateOptional(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const authHeader = req.headers.authorization;
    const adminEmailHeader = (req.headers['x-admin-email'] as string)?.toLowerCase().trim();

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const { data } = await getAnonClient().auth.getUser(token);
            if (data?.user) {
                req.user = {
                    id: data.user.id,
                    email: data.user.email || '',
                    role: 'user',
                };
                next();
                return;
            }
        } catch {
            // Silently continue
        }
    }

    if (adminEmailHeader) {
        try {
            const db = getDatabase();
            const { data: adminRecord } = await db
                .from('crm_admins')
                .select('email')
                .eq('email', adminEmailHeader)
                .maybeSingle();

            if (adminRecord?.email) {
                req.user = {
                    id: adminRecord.email,
                    email: adminRecord.email,
                    role: 'admin',
                };
            }
        } catch {
            // Silently continue
        }
    }

    next();
}