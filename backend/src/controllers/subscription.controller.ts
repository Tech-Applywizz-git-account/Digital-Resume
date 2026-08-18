import { Request, Response } from 'express';
import { subscriptionService } from '../services/subscription/subscription.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const subscriptionController = {
    getMyTier: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const result = await subscriptionService.getEffectiveUserTier(userId);
        return res.status(200).json({ success: true, data: result });
    }),

    switchTier: asyncHandler(async (req: Request, res: Response) => {
        const adminEmail = req.user?.email;
        if (!adminEmail) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const body = (req.validatedBody ?? req.body) as {
            email?: string;
            userId?: string;
            toTier: 'digital_resume' | 'career_identity';
            reason?: string;
        };
        const result = await subscriptionService.switchUserTier({
            adminEmail,
            adminUserId: req.user?.id ?? null,
            email: body.email,
            userId: body.userId,
            toTier: body.toTier,
            reason: body.reason,
        });

        return res.status(200).json({ success: true, data: result });
    }),

    listTierLogs: asyncHandler(async (req: Request, res: Response) => {
        const adminEmail = req.user?.email;
        if (!adminEmail) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const query = (req.validatedQuery ?? req.query) as { email?: string; userId?: string };
        const logs = await subscriptionService.listTierLogs({
            adminEmail,
            email: query.email,
            userId: query.userId,
        });

        return res.status(200).json({ success: true, data: logs });
    }),
};
