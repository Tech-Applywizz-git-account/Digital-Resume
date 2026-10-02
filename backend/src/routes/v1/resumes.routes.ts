import { Router } from 'express';
import multer from 'multer';
import { resumeController } from '../../controllers/resume.controller.js';
import { authenticateOptional, authenticate } from '../../middleware/authenticate.js';
import { validateParams } from '../../middleware/validate.js';
import { getResumeParamsSchema } from '../../validation/schemas/resume.schema.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get(
    '/:castId',
    authenticateOptional,
    validateParams(getResumeParamsSchema),
    resumeController.getResume,
);

router.post(
    '/create-job-request',
    authenticate,
    resumeController.createJobRequest,
);

router.post(
    '/upload',
    authenticate,
    upload.single('file'),
    resumeController.uploadResume,
);

router.get(
    '/history',
    authenticate,
    resumeController.getHistory,
);

router.put(
    '/:jobRequestId/description',
    authenticate,
    resumeController.updateJobDescription,
);

export { router as resumesRouter };