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
};