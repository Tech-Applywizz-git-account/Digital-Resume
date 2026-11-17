import { Request, Response } from 'express';
import { profileService } from '../services/profile/profile.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticate } from '../middleware/authenticate.js';

export const profileController = {
    getProfile: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const profile = await profileService.getProfile(userId);
        return res.status(200).json({ success: true, data: profile });
    }),

    updateProfile: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const updated = await profileService.updateProfile(userId, req.body);
        return res.status(200).json({ success: true, data: updated });
    }),
};
