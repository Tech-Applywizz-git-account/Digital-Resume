import { Router } from 'express';
import { profileController } from '../../controllers/profile.controller.js';

const router = Router();

router.get('/profile', profileController.getProfile);
router.put('/profile', profileController.updateProfile);

export default router;