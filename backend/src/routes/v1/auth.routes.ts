import { Router } from 'express';
import { authController } from '../../controllers/auth.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../middleware/validate.js';
import { resolveEmailSchema } from '../../validation/schemas/auth.schema.js';

const router = Router();

router.post('/resolve-email', validateBody(resolveEmailSchema), authController.resolveEmail);

router.get('/me', authenticate, authController.me);

export { router as authRouter };