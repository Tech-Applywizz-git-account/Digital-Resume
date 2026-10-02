import { Router } from 'express';
import { walletController } from '../../controllers/wallet.controller.js';
import { authenticateOptional } from '../../middleware/authenticate.js';

const router = Router();

/**
 * Public for published Career Identity profiles.
 * Drafts remain owner-only (optional Bearer token).
 */
router.get('/:castId/status', authenticateOptional, walletController.getStatus);
router.get('/:castId/apple-wallet-pass', authenticateOptional, walletController.getAppleWalletPass);
router.get('/:castId/google-wallet', authenticateOptional, walletController.getGoogleWalletSaveUrl);
router.get('/:castId/card', authenticateOptional, walletController.getWalletCard);

export { router as walletRouter };
