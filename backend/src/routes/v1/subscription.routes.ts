import { Router } from 'express';
import { subscriptionController } from '../../controllers/subscription.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.get(
    '/me',
    authenticate,
    subscriptionController.getMyTier,
);

export { router as subscriptionRouter };