import { Request, Response } from 'express';
import { careerIdentityService } from '../services/careerIdentity/careerIdentity.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { ForbiddenError } from '../types/errors.js';
import { getDatabase } from '../config/database.js';

/**
 * Career Identity Admin Controller
 *
 * Admin-only endpoints for managing Career Identity requests.
 * All endpoints require admin authentication (verified via crm_admins table).
 * The route middleware ensures authenticate() runs first, then this
 * controller performs the admin check.
 */
async function verifyAdmin(email: string): Promise<void> {
    const db = getDatabase();
    const { data } = await db
        .from('crm_admins')
        .select('email')
        .eq('email', email)
        .maybeSingle();

    if (!data) {
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

        const filter: { workflowStatus?: string; status?: string } = {};
        if (workflowStatus) filter.workflowStatus = workflowStatus;
        if (status) filter.status = status;

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

        const { workflowStatus, status, themeId, content, walletPassUrl } = req.body;

        const result = await careerIdentityService.adminUpdateRequest(targetUserId, {
            workflowStatus,
            status,
            themeId,
            content,
            walletPassUrl,
        });

        return res.status(200).json({ success: true, data: result });
    }),
};