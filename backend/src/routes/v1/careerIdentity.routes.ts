import { Router, type RequestHandler } from 'express';
import { careerIdentityController } from '../../controllers/careerIdentity.controller.js';
import { careerIdentityAdminController } from '../../controllers/careerIdentityAdmin.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

import { UnauthorizedError } from '../../types/errors.js';

const router = Router();

const requireSession: RequestHandler = (req, res, next) => {
    void authenticate(req, res, (error?: unknown) => {
        if (error) return next(error);
        if (req.user?.role !== 'user') return next(new UnauthorizedError('A valid sign-in session is required'));
        next();
    });
};

// Public route — recruiters viewing a Career Identity page (no auth required)
router.get('/profile/public/:castId', careerIdentityController.getPublicProfile);
router.get('/profile/public/:castId/assets/:kind', careerIdentityController.getPublicAsset);

// Authenticated routes — owner operations
router.get('/viewer', requireSession, careerIdentityController.viewer);
router.get('/dashboard', requireSession, careerIdentityController.dashboard);
router.post('/submissions', requireSession, careerIdentityController.submit);
router.delete('/submissions/:submissionId', requireSession, careerIdentityController.withdraw);
router.patch('/appearance', requireSession, careerIdentityController.appearance);
router.patch('/consent', requireSession, careerIdentityController.consent);
router.get('/profile', requireSession, careerIdentityController.getProfile);
router.patch('/profile', requireSession, careerIdentityController.updateProfile);

// Admin routes — Career Identity management
router.get('/admin/requests', requireSession, careerIdentityAdminController.listRequests);
router.get('/admin/requests/:userId', requireSession, careerIdentityAdminController.getRequest);
router.patch('/admin/requests/:userId', requireSession, careerIdentityAdminController.updateRequest);
router.post('/admin/requests/:userId/auto-fill', requireSession, careerIdentityAdminController.autoFillRequest);
export default router;
