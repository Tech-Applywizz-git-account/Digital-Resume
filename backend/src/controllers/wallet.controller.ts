import { Request, Response } from 'express';
import { walletService, walletProviderRegistry } from '../services/wallet/wallet.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { crmJobRequestRepository } from '../repositories/crmJobRequest.repository.js';
import { jobRequestRepository } from '../repositories/jobRequest.repository.js';
import { profileRepository } from '../repositories/profile.repository.js';
import { NotFoundError } from '../types/errors.js';
import { trackingService } from '../services/analytics/tracking.service.js';
import { subscriptionService } from '../services/subscription/subscription.service.js';

const CARD_BASE_URL: string = process.env.CAREER_IDENTITY_PUBLIC_URL || 'https://applywizz.com';

async function resolveWalletRecord(castId: string) {
    const [crmResult, regularResult] = await Promise.all([
        crmJobRequestRepository.findOne({ id: castId } as any),
        jobRequestRepository.findOne({ id: castId } as any),
    ]);
    const record = crmResult || regularResult;
    if (!record) throw new NotFoundError('Career Identity profile', castId);
    return { record, isCRM: !!crmResult };
}

function verifyOwnership(record: any, authenticatedUserId: string): void {
    const ownerId: string | null = record.user_id || null;
    if (!ownerId || ownerId !== authenticatedUserId) {
        throw new Error('Forbidden: you do not own this Career Identity profile');
    }
}

async function loadProfileData(castId: string, userId: string, record: any) {
    const userProfile = await profileRepository.findById(userId);
    const ciData = (userProfile?.career_identity_data || {}) as Record<string, any>;
    const content: Record<string, any> = (ciData.content || {}) as Record<string, any>;
    const hero: Record<string, any> = (content.hero || {}) as Record<string, any>;

    const fullName: string | null = (hero.fullName as string) || userProfile?.full_name || userProfile?.first_name || null;
    const profileImageUrl: string | null = (hero.profileImageUrl as string) || null;
    const contactObj: any = content.contact || null;
    const location: string | null = contactObj?.location || null;
    const email: string | null = contactObj?.email || null;
    const phone: string | null = contactObj?.phone || null;
    const headline: string | null = (hero.headline as string) || null;
    const jobTitle: string | null = (record as any).job_title || headline;
    const company: string | null = (record as any).company_name || null;

    return {
        fullName, profileImageUrl, location, email, phone, headline, jobTitle, company,
        careerIdentityUrl: `${CARD_BASE_URL}/career-identity/${castId}`,
        castId,
    };
}

export const walletController = {
    /** Native Apple Wallet (.pkpass) — unchanged. */
    getAppleWalletPass: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const castId: string = req.params.castId as string;
        if (!castId) {
            return res.status(400).json({ success: false, message: 'castId is required' });
        }

        try {
            const passBuffer = await walletService.generatePass(castId, userId, req.user?.email || '');
            res.set({
                'Content-Type': 'application/vnd.apple.pkpass',
                'Content-Disposition': `attachment; filename="career-identity-${castId}.pkpass"`,
                'Content-Length': passBuffer.length.toString(),
            });
            return res.status(200).send(passBuffer);
        } catch (err: any) {
            const message = err?.message || 'Failed to generate Apple Wallet pass';
            if (message.includes('not configured') || message.includes('Missing PassKit')) {
                return res.status(503).json({ success: false, message });
            }
            if (message.includes('only available for Career Identity')) {
                return res.status(403).json({ success: false, message });
            }
            if (message.includes('not found')) {
                return res.status(404).json({ success: false, message });
            }
            if (message.includes('Forbidden') || message.includes('do not own')) {
                return res.status(403).json({ success: false, message });
            }
            return res.status(500).json({ success: false, message });
        }
    }),

    /**
     * GET /:castId/card
     * Generates a wallet card (PNG) for import into Apple Wallet.
     * Provider-agnostic endpoint -- delegates to registered provider.
     * Currently uses the neatpass provider (no Apple certificates needed).
     */
    getWalletCard: asyncHandler(async (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const castId: string = req.params.castId as string;
        if (!castId) {
            return res.status(400).json({ success: false, message: 'castId is required' });
        }

        try {
            const sessionId = `wallet-${castId}-${Date.now()}`;
            const provider = 'neatpass';

            // Track: button clicked
            try {
                await trackingService.trackEvent({
                    resumeId: castId,
                    sessionId,
                    eventType: 'wallet_button_clicked',
                    metadata: { source: 'career_identity_page', castId, provider },
                });
            } catch { /* non-fatal */ }

            // Verify ownership + subscription
            const { record } = await resolveWalletRecord(castId);
            verifyOwnership(record, userId);

            const tier = await subscriptionService.getTier(castId);
            if (tier !== 'career_identity') {
                return res.status(403).json({
                    success: false,
                    message: 'Wallet card is only available for Career Identity profiles.',
                });
            }

            // Load profile data
            const data = await loadProfileData(castId, userId, record);

            // Generate card via registered provider
            const walletProvider = walletProviderRegistry.getProvider('neatpass');
            const cardBuffer = await walletProvider.generateCard(data);

            // Track: card generated
            try {
                await trackingService.trackEvent({
                    resumeId: castId,
                    sessionId,
                    eventType: 'wallet_card_generated',
                    metadata: { source: 'career_identity_page', castId, provider },
                });
            } catch { /* non-fatal */ }

            // Track: card downloaded (sending file)
            try {
                await trackingService.trackEvent({
                    resumeId: castId,
                    sessionId,
                    eventType: 'wallet_card_downloaded',
                    metadata: { source: 'career_identity_page', castId, provider },
                });
            } catch { /* non-fatal */ }

            // Send response
            res.set({
                'Content-Type': walletProvider.getMimeType(),
                'Content-Disposition': `attachment; filename="career-identity-card-${castId}.${walletProvider.getFileExtension()}"`,
                'Content-Length': cardBuffer.length.toString(),
            });
            return res.status(200).send(cardBuffer);
        } catch (err: any) {
            const message = err?.message || 'Failed to generate wallet card';
            if (message.includes('not found')) {
                return res.status(404).json({ success: false, message });
            }
            if (message.includes('Forbidden') || message.includes('do not own')) {
                return res.status(403).json({ success: false, message });
            }
            return res.status(500).json({ success: false, message });
        }
    }),
};