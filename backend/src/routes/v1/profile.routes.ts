import { Router } from 'express';
import { profileController } from '../../controllers/profile.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

// Mounted at /api/v1/profile → GET/PUT /
router.get('/', authenticate, profileController.getProfile);
router.put('/', authenticate, profileController.updateProfile);

export default router;
