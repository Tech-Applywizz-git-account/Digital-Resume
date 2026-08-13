import { Request, Response } from 'express';
import { careerIdentityService } from '../services/careerIdentity/careerIdentity.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const careerIdentityController = {
    /**
     * Public endpoint — no authentication required.
     * Returns the Career Identity profile for recruiters to view.
     * Only returns published profiles. Profile is NOT auto-created for public viewers.
     * Flow: castId → crm_job_requests/job_requests → user_id → profiles.career_identity_data
     */
    getPublicProfile: asyncHandler(async (req: Request, res: Response) => {
        const castId = req.params.castId as string | undefined;
        if (!castId) {
            return res.status(400).json({ success: false, message: 'castId is required' });
        }

        const result = await careerIdentityService.getPublicProfile(castId);
        return res.status(200).json({ success: true, data: result });
    }),

    /**
     * Authenticated endpoint — returns the Career Identity profile for the
     * logged-in user. Ownership is verified by checking profiles.id === userId.
     * No need to look up job_requests for ownership — the user's profile is
     * the single source of truth.
     */
    getProfile: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const resumeId = req.query.resume_id as string;
        if (!resumeId) {
            return res.status(400).json({ success: false, message: 'resume_id is required' });
        }

        // Ownership is implicit: the authenticated user can only access their own profile
        const result = await careerIdentityService.getProfile(resumeId, userId);
        return res.status(200).json({ success: true, data: result });
    }),

    /**
     * Authenticated endpoint — updates the Career Identity profile for the
     * logged-in user. Ownership is verified by checking profiles.id === userId.
     */
    updateProfile: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { resume_id, content, status, workflowStatus } = req.body;
        if (!resume_id) {
            return res.status(400).json({ success: false, message: 'resume_id is required' });
        }

        // Ownership is implicit: the authenticated user can only update their own profile
        const result = await careerIdentityService.updateProfile(resume_id, userId, { content, status, workflowStatus });
        return res.status(200).json({ success: true, data: result });
    }),
};