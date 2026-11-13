import { Request, Response } from 'express';
import { careerIdentityService } from '../services/careerIdentity/careerIdentity.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { AppError, ConflictError, ForbiddenError } from '../types/errors.js';
import { getDatabase } from '../config/database.js';
import { getProject } from '../services/careerIdentity/submissions.service.js';
import { logger } from '../logger/index.js';

/**
 * Career Identity Admin Controller
 *
 * Admin-only endpoints for managing Career Identity requests.
 * All endpoints require admin authentication (verified via crm_admins table).
 * The route middleware ensures authenticate() runs first, then this
 * controller performs the admin check.
 */
export async function verifyAdmin(email: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    if (!normalized) {
        throw new ForbiddenError('Admin access required');
    }
    const db = getDatabase();
    const { data } = await db
        .from('crm_admins')
        .select('email')
        .ilike('email', normalized)
        .maybeSingle();

    if (!data || data.email.toLowerCase().trim() !== normalized) {
        throw new ForbiddenError('Admin access required');
    }
}

export const careerIdentityAdminController = {
    /**
     * GET /api/v1/career-identity/admin/requests
     * Lists all Career Identity requests with optional filtering.
     */
    listRequests: asyncHandler(async (req: Request, res: Response) => {
        const email = req.user?.email;
        if (!email) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        await verifyAdmin(email);

        const workflowStatus = req.query.workflowStatus as string | undefined;
        const status = req.query.status as string | undefined;
        const clarityStatus = req.query.clarityStatus as string | undefined;

        const filter: { workflowStatus?: string; status?: string; clarityStatus?: string } = {};
        if (workflowStatus) filter.workflowStatus = workflowStatus;
        if (status) filter.status = status;
        if (clarityStatus) filter.clarityStatus = clarityStatus;

        const requests = await careerIdentityService.listRequests(
            Object.keys(filter).length > 0 ? filter : undefined
        );

        return res.status(200).json({ success: true, data: requests });
    }),

    /**
     * GET /api/v1/career-identity/admin/requests/:userId
     * Returns full details for a single Career Identity request.
     */
    getRequest: asyncHandler(async (req: Request, res: Response) => {
        const adminEmail = req.user?.email;
        if (!adminEmail) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        await verifyAdmin(adminEmail);

        const targetUserId = req.params.userId as string;
        if (!targetUserId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
        }

        const request = await careerIdentityService.getRequest(targetUserId);
        if (req.query.submissionId && req.query.submissionId !== request.submissionId) {
            throw new ConflictError('The submission changed. Return to the request list and reopen it.');
        }
        return res.status(200).json({ success: true, data: request });
    }),

    /**
     * PATCH /api/v1/career-identity/admin/requests/:userId
     * Updates a Career Identity request (workflowStatus, status, themeId, content).
     */
    updateRequest: asyncHandler(async (req: Request, res: Response) => {
        const adminEmail = req.user?.email;
        if (!adminEmail) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        await verifyAdmin(adminEmail);

        const targetUserId = req.params.userId as string;
        if (!targetUserId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
        }

        const { workflowStatus, status, themeId, content, walletPassUrl, clarity } = req.body;

        const project = await getProject(targetUserId);
        const submissionId = req.get('X-CI-Submission-Id');
        if (project?.pending_submission_id || project?.published_submission_id || submissionId || (project && clarity)) {
            if ((status != null && !['draft', 'published'].includes(status)) ||
                (themeId != null && !['aurora', 'zenith', 'atlas'].includes(themeId)) ||
                (workflowStatus != null && !['submitted', 'in_progress', 'ready_for_review', 'changes_requested'].includes(workflowStatus)) ||
                [content, clarity].some(value => value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value)))) {
                throw new AppError(422, 'CI_INVALID_UPDATE', 'Invalid Career Identity update.');
            }
            if (!submissionId && !project?.pending_submission_id && !project?.published_submission_id) {
                await careerIdentityService.getRequest(targetUserId);
            }
            const { error } = await getDatabase().rpc('ci_admin_save', {
                p_user: targetUserId, p_submission: submissionId ?? null, p_admin: req.user!.id,
                p_data: {
                    workflowStatus, status, themeId, content, walletPassUrl,
                    // An admin configuration change requires a fresh activation decision.
                    clarity: clarity ? { ...clarity, clientPausedProjectId: null } : undefined,
                },
            });
            if (error?.code === '40001') throw new ConflictError(error.message);
            if (error) {
                logger.error({ err: error, requestId: req.requestId, operation: 'ci_admin_save' }, 'Career Identity admin save failed');
                if (error.code === 'PGRST202' || error.code === '42883') {
                    throw new AppError(503, 'CI_ADMIN_SETUP_REQUIRED', 'Career Identity admin setup is incomplete. Apply the workflow database migration and retry.');
                }
                throw error;
            }
            return res.json({ success: true, data: await careerIdentityService.getRequest(targetUserId) });
        }
        await careerIdentityService.getRequest(targetUserId);
        const result = await careerIdentityService.adminUpdateRequest(targetUserId, {
            workflowStatus,
            status,
            themeId,
            content,
            walletPassUrl,
            clarity,
        });

        return res.status(200).json({ success: true, data: result });
    }),

    /**
     * POST /api/v1/career-identity/admin/requests/:userId/auto-fill
     * Parses the user's latest resume and returns candidate content.
     * NOTE: Does NOT mutate the database.
     */
    autoFillRequest: asyncHandler(async (req: Request, res: Response) => {
        const adminEmail = req.user?.email;
        if (!adminEmail) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        await verifyAdmin(adminEmail);

        const targetUserId = req.params.userId as string;
        if (!targetUserId) {
            return res.status(400).json({ success: false, message: 'userId is required' });
        }

        const result = await careerIdentityService.autoFillFromResume(targetUserId, req.get('X-CI-Submission-Id'));
        return res.status(200).json({ success: true, data: result });
    }),
};
