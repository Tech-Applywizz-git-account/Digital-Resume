import { Router } from 'express';
import multer from 'multer';
import { resumeController } from '../../controllers/resume.controller.js';
import { authenticateOptional, authenticate } from '../../middleware/authenticate.js';
import { validateParams } from '../../middleware/validate.js';
import { AppError } from '../../types/errors.js';
import { getResumeParamsSchema } from '../../validation/schemas/resume.schema.js';

const router = Router();
// The multipart parser signals a limit at equality. Stop at the first excess byte.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 + 1 } }).single('file');

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
    (req, res, next) => {
        upload(req, res, (error) => {
            if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
                return next(new AppError(413, 'RESUME_TOO_LARGE', 'Your PDF exceeds 10 MB.'));
            }
            next(error);
        });
    },
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