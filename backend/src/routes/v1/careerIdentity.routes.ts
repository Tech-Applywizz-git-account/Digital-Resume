import { Router } from 'express';
import { careerIdentityController } from '../../controllers/careerIdentity.controller.js';
import { careerIdentityAdminController } from '../../controllers/careerIdentityAdmin.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

// Public route — recruiters viewing a Career Identity page (no auth required)
router.get('/profile/public/:castId', careerIdentityController.getPublicProfile);

// Authenticated routes — owner operations
router.get('/profile', authenticate, careerIdentityController.getProfile);
router.patch('/profile', authenticate, careerIdentityController.updateProfile);

// Admin routes — Career Identity management
router.get('/admin/requests', authenticate, careerIdentityAdminController.listRequests);
router.get('/admin/requests/:userId', authenticate, careerIdentityAdminController.getRequest);
router.patch('/admin/requests/:userId', authenticate, careerIdentityAdminController.updateRequest);
export default router;
