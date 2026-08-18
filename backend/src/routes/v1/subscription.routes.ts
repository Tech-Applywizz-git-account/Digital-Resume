import { Router } from 'express';
import { subscriptionController } from '../../controllers/subscription.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { switchTierSchema, tierLogsQuerySchema } from '../../validation/schemas/subscription.schema.js';

const router = Router();

router.get(
    '/me',
    authenticate,
    subscriptionController.getMyTier,
);

router.patch(
    '/admin/tier',
    authenticate,
    validateBody(switchTierSchema),
    subscriptionController.switchTier,
);

router.get(
    '/admin/tier-logs',
    authenticate,
    validateQuery(tierLogsQuerySchema),
    subscriptionController.listTierLogs,
);

export { router as subscriptionRouter };