import { Request, Response } from 'express';
import { resumeService } from '../services/resume/resume.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const resumeController = {
    getResume: asyncHandler(async (req: Request, res: Response) => {
        const { castId } = req.params;
        const resume = await resumeService.resolveFullResume(castId as string);
        return res.status(200).json({ success: true, data: resume });
    }),

    createJobRequest: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        const email = req.user?.email;
        if (!userId || !email) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { jobTitle, jobDescription } = req.body;

        const result = await resumeService.createJobRequest({
            userId,
            email,
            jobTitle,
            jobDescription,
        });

        return res.status(201).json({ success: true, data: result });
    }),

    uploadResume: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        const email = req.user?.email;
        if (!userId || !email) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const file = req.file;
        if (!file || file.size === 0) {
            return res.status(400).json({ success: false, message: 'Please choose a non-empty PDF file.' });
        }
        if (file.mimetype !== 'application/pdf' || file.buffer.toString('latin1', 0, 5) !== '%PDF-') {
            return res.status(415).json({ success: false, message: 'Please upload a PDF file only.' });
        }

        const { jobRequestId } = req.body;

        const result = await resumeService.uploadResume({
            userId,
            email,
            fileBuffer: file.buffer,
            originalName: file.originalname,
            mimeType: file.mimetype,
            jobRequestId,
            replace: req.body.replace === 'true',
        });

        return res.status(201).json({ success: true, data: result });
    }),

    getHistory: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        const email = req.user?.email;
        if (!userId || !email) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const isCRM = req.query.isCRM === 'true';

        const history = await resumeService.getHistory(email, isCRM);
        return res.status(200).json({ success: true, data: history });
    }),

    updateJobDescription: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        const email = req.user?.email;
        if (!userId || !email) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { jobDescription } = req.body;
        const jobRequestId = req.params.jobRequestId as string;

        if (!jobRequestId) {
            return res.status(400).json({ success: false, message: 'Job request ID required' });
        }

        await resumeService.updateJobDescription(userId, email, jobRequestId, jobDescription);
        return res.status(200).json({ success: true, message: 'Updated successfully' });
    }),
};
