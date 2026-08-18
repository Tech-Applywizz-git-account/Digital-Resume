import { Request, Response } from 'express';
import { walletService, walletProviderRegistry } from '../services/wallet/wallet.service.js';
import { getWalletStatus } from '../services/wallet/walletProfile.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { trackingService } from '../services/analytics/tracking.service.js';

function sendWalletError(res: Response, err: any) {
    const message = err?.message || 'Wallet request failed';
    if (message.includes('not configured') || message.includes('Missing PassKit')) {
        return res.status(503).json({ success: false, message });
    }
    if (message.includes('only available') || message.includes('Forbidden') || message.includes('do not own')) {
        return res.status(403).json({ success: false, message });
    }
    if (message.includes('not found') || err?.statusCode === 404) {
        return res.status(404).json({ success: false, message });
    }
    return res.status(500).json({ success: false, message });
}

export const walletController = {
    getStatus: asyncHandler(async (req: Request, res: Response) => {
        const castId = req.params.castId as string;
        if (!castId) {
            return res.status(400).json({ success: false, message: 'castId is required' });
        }
        try {
            const status = await getWalletStatus(castId, req.user?.id);
            return res.status(200).json({ success: true, data: status });
        } catch (err: any) {
            return sendWalletError(res, err);
        }
    }),

    getAppleWalletPass: asyncHandler(async (req: Request, res: Response) => {
        const castId = req.params.castId as string;
        if (!castId) {
            return res.status(400).json({ success: false, message: 'castId is required' });
        }

        try {
            const passBuffer = await walletService.generatePass(castId, req.user?.id);
            res.set({
                'Content-Type': 'application/vnd.apple.pkpass',
                'Content-Disposition': `attachment; filename="career-identity-${castId}.pkpass"`,
                'Content-Length': passBuffer.length.toString(),
            });
            return res.status(200).send(passBuffer);
        } catch (err: any) {
            return sendWalletError(res, err);
        }
    }),

    getGoogleWalletSaveUrl: asyncHandler(async (req: Request, res: Response) => {
        const castId = req.params.castId as string;
        if (!castId) {
            return res.status(400).json({ success: false, message: 'castId is required' });
        }

        try {
            const saveUrl = await walletService.generateGoogleSaveUrl(castId, req.user?.id);
            return res.status(200).json({ success: true, data: { saveUrl } });
        } catch (err: any) {
            return sendWalletError(res, err);
        }
    }),

    getWalletCard: asyncHandler(async (req: Request, res: Response) => {
        const castId = req.params.castId as string;
        if (!castId) {
            return res.status(400).json({ success: false, message: 'castId is required' });
        }

        try {
            const sessionId = `wallet-${castId}-${Date.now()}`;
            try {
                await trackingService.trackEvent({
                    resumeId: castId,
                    sessionId,
                    eventType: 'wallet_button_clicked',
                    metadata: { source: 'career_identity_page', castId, provider: 'visual' },
                });
            } catch { /* non-fatal */ }

            const { buffer } = await walletService.generateVisualCard(castId, req.user?.id);
            const provider = walletProviderRegistry.getProvider('neatpass');

            try {
                await trackingService.trackEvent({
                    resumeId: castId,
                    sessionId,
                    eventType: 'wallet_card_generated',
                    metadata: { source: 'career_identity_page', castId, provider: 'visual' },
                });
            } catch { /* non-fatal */ }

            res.set({
                'Content-Type': provider.getMimeType(),
                'Content-Disposition': `attachment; filename="career-identity-card-${castId}.${provider.getFileExtension()}"`,
                'Content-Length': buffer.length.toString(),
            });
            return res.status(200).send(buffer);
        } catch (err: any) {
            return sendWalletError(res, err);
        }
    }),
};
