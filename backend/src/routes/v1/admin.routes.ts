import { Router, type Request } from 'express';
import { createClient } from '@supabase/supabase-js';
import { getDatabase } from '../../config/database.js';
import { environment } from '../../config/environment.js';
import { authenticate } from '../../middleware/authenticate.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { AppError, ConflictError, ForbiddenError, UnauthorizedError } from '../../types/errors.js';
import { logger } from '../../logger/index.js';
import { getBusinessOverview } from '../../services/admin/businessOverview.service.js';

export const adminRouter = Router();

adminRouter.use(authenticate, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.user?.role !== 'user') return next(new UnauthorizedError('Sign in to continue.'));
    next();
});

async function adminRole(req: Request) {
    const email = req.user!.email.trim().toLowerCase();
    if (!email) return null;
    const { data, error } = await getDatabase().from('crm_admins')
        .select('email, role').ilike('email', email.replace(/[\\%_]/g, '\\$&')).maybeSingle();
    if (error) throw error;
    if (data?.email.trim().toLowerCase() !== email) return null;
    return data.role === 'super_admin' ? 'super_admin' : data.role === 'admin' ? 'admin' : null;
}

async function requireAdmin(req: Request, superOnly = false) {
    const role = await adminRole(req);
    if (!role || (superOnly && role !== 'super_admin')) throw new ForbiddenError();
    return role;
}

adminRouter.get('/me', asyncHandler(async (req, res) => {
    res.json({ data: { role: await adminRole(req) } });
}));

adminRouter.get('/business-overview', asyncHandler(async (req, res) => {
    await requireAdmin(req, true);
    res.json({ data: await getBusinessOverview() });
}));

adminRouter.get('/accounts', asyncHandler(async (req, res) => {
    await requireAdmin(req);
    const { data, error } = await getDatabase().from('crm_admins')
        .select('email, role, created_at').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data });
}));

adminRouter.post('/accounts', asyncHandler(async (req, res) => {
    const actorRole = await requireAdmin(req);
    const { email: rawEmail, password, role = 'admin' } = req.body ?? {};
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        !['admin', 'super_admin'].includes(role) || (password !== undefined && typeof password !== 'string')) {
        throw new AppError(422, 'INVALID_ADMIN_ACCOUNT', 'Enter a valid email and role.');
    }
    if (role === 'super_admin' && actorRole !== 'super_admin') throw new ForbiddenError();
    const db = getDatabase();
    const membership = await db.from('crm_admins').select('email')
        .ilike('email', email.replace(/[\\%_]/g, '\\$&')).maybeSingle();
    if (membership.error) throw membership.error;
    if (membership.data) throw new ConflictError('This account already has admin access.');

    // Check Auth first so access can be granted without resetting an existing password.
    let exists = false;
    for (let page = 1; ; page++) {
        const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) throw error;
        exists = data.users.some(user => user.email?.toLowerCase() === email);
        if (exists || !data.nextPage) break;
    }
    if (!exists) {
        if (!password || password.length < 6 || password.length > 128) {
            throw new AppError(422, 'ADMIN_PASSWORD_REQUIRED', 'Set a password of 6–128 characters for a new account.');
        }
        // Use the existing signup flow to preserve the project's confirmation requirements.
        const signupClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        });
        const { data, error } = await signupClient.auth.signUp({ email, password });
        if (error || !data.user) {
            throw new AppError(422, 'ADMIN_SIGNUP_FAILED', error?.message || 'Could not create the sign-in account.');
        }
    }

    const { data, error } = await db.from('crm_admins').insert({
        email, role, added_by: req.user!.email,
    }).select('email, role, created_at').single();
    if (error?.code === '23505') throw new ConflictError('This account already has admin access.');
    if (error) {
        logger.error({ err: error, requestId: req.requestId }, 'Admin membership creation failed');
        throw new AppError(503, 'ADMIN_ACCESS_NOT_GRANTED', 'Admin access was not granted. Retry with the same email.');
    }
    logger.info({ actorId: req.user!.id, target: email, role }, 'Admin access granted');
    res.status(201).json({ data });
}));

adminRouter.patch('/accounts/:email/role', asyncHandler(async (req, res) => {
    await requireAdmin(req, true);
    const email = String(req.params.email).trim().toLowerCase();
    const role = req.body?.role;
    if (role !== 'super_admin' && role !== 'admin') {
        throw new AppError(422, 'INVALID_ADMIN_ROLE', 'Choose a supported admin role.');
    }
    const { data, error } = await getDatabase().rpc('set_crm_admin_role', {
        p_actor: req.user!.email.trim().toLowerCase(), p_target: email, p_role: role,
    });
    if (error?.code === '40001') throw new ConflictError(error.message);
    if (error?.code === '42501') throw new ForbiddenError();
    if (error?.code === 'PGRST202' || error?.code === '42883') {
        throw new AppError(503, 'ADMIN_ROLE_SETUP_REQUIRED', 'Role management is unavailable until the admin permissions migration is applied.');
    }
    if (error) throw error;
    logger.info({ actorId: req.user!.id, target: email, role }, 'Admin role changed');
    res.json({ data });
}));
