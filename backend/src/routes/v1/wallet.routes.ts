import { Router } from 'express';
import { walletController } from '../../controllers/wallet.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.get(
    '/:castId/apple-wallet-pass',
    authenticate,
    walletController.getAppleWalletPass,
);

/**
 * GET /:castId/card
 * Generates a branded PNG wallet card for NeatPass import into Apple Wallet.
 * No Apple PassKit certificates required — free alternative using NeatPass.
 */
router.get(
    '/:castId/card',
    authenticate,
    walletController.getWalletCard,
);

export { router as walletRouter };
