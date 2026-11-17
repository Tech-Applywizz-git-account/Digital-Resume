import { Request, Response } from 'express';
import { authService } from '../services/auth/auth.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const authController = {
    resolveEmail: asyncHandler(async (req: Request, res: Response) => {
        const { email } = req.validatedBody as { email: string };
        const resolved = await authService.resolveLoginEmail(email);
        res.status(200).json({ success: true, data: { email: resolved } });
    }),

    me: asyncHandler(async (req: Request, res: Response) => {
        res.status(200).json({ success: true, data: req.user });
    }),
};