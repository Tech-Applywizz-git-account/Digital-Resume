import { profileRepository } from '../../repositories/profile.repository.js';
import { crmJobRequestRepository } from '../../repositories/crmJobRequest.repository.js';
import { jobRequestRepository } from '../../repositories/jobRequest.repository.js';
import { subscriptionService } from '../subscription/subscription.service.js';
import { ForbiddenError, NotFoundError } from '../../types/errors.js';
import type { WalletCardData } from './wallet.types.js';

const DEFAULT_WALLET_GREETING = "Hi ✋, I'm";

function normalizeWalletTitle(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
        const trimmed = value?.trim();
        if (!trimmed) continue;
        if (trimmed.toLowerCase() === 'new digital resume') continue;
        return trimmed;
    }
    return DEFAULT_WALLET_GREETING;
}

export function publicCareerIdentityUrl(castId: string): string {
    const base = (process.env.CAREER_IDENTITY_PUBLIC_URL || 'https://applywizz.com').replace(/\/$/, '');
    if (base.includes('/career-identity/')) {
        return base;
    }
    return `${base}/career-identity/${castId}`;
}

export async function resolveCastRecord(castId: string): Promise<{ record: any; isCRM: boolean }> {
    const [crmResult, regularResult] = await Promise.all([
        crmJobRequestRepository.findOne({ id: castId } as any),
        jobRequestRepository.findOne({ id: castId } as any),
    ]);
    const record = crmResult || regularResult;
    if (!record) {
        throw new NotFoundError('Career Identity profile', castId);
    }
    return { record, isCRM: !!crmResult };
}

/**
 * Public visitors may download a pass only when the profile is published.
 * The owner may always generate a pass for their own unpublished draft.
 */
export async function assertWalletAccess(castId: string, authenticatedUserId?: string): Promise<{
    record: any;
    userId: string;
    published: boolean;
}> {
    const { record } = await resolveCastRecord(castId);
    const userId: string | null = record.user_id || null;
    if (!userId) {
        throw new NotFoundError('Career Identity profile', castId);
    }

    const tier = await subscriptionService.getTier(castId);
    if (tier !== 'career_identity') {
        throw new ForbiddenError('Wallet passes are only available for Career Identity profiles.');
    }

    const profile = await profileRepository.findById(userId);
    const ciData = (profile?.career_identity_data || {}) as Record<string, any>;
    const published = ciData.status === 'published';
    const isOwner = !!authenticatedUserId && authenticatedUserId === userId;

    if (!published && !isOwner) {
        throw new NotFoundError('Career Identity profile', castId);
    }

    return { record, userId, published };
}

export async function loadWalletCardData(castId: string, record: any, userId: string): Promise<WalletCardData> {
    const userProfile = await profileRepository.findById(userId);
    const ciData = (userProfile?.career_identity_data || {}) as Record<string, any>;
    const content: Record<string, any> = ciData.content || {};
    const hero: Record<string, any> = content.hero || {};
    const contact: Record<string, any> = content.contact || {};

    return {
        fullName: hero.fullName || userProfile?.full_name || userProfile?.first_name || null,
        jobTitle: normalizeWalletTitle(hero.headline, record.job_title),
        headline: hero.headline || null,
        location: contact.location || null,
        email: contact.email || userProfile?.email || null,
        phone: contact.phone || null,
        linkedin: contact.linkedin || null,
        profileImageUrl: hero.profileImageUrl || null,
        careerIdentityUrl: publicCareerIdentityUrl(castId),
        castId,
        company: record.company_name || null,
        verified: !!hero.verified,
        openToWork: !!hero.openToWork,
        openToRelocate: !!hero.openToRelocate,
        remote: !!hero.remote,
        immediateJoiner: !!hero.immediateJoiner,
    };
}

export async function getWalletStatus(castId: string, authenticatedUserId?: string) {
    const { record, userId } = await assertWalletAccess(castId, authenticatedUserId);
    const profile = await profileRepository.findById(userId);
    const ciData = (profile?.career_identity_data || {}) as Record<string, any>;

    const appleReady = !!(
        process.env.APPLE_PASS_TYPE_IDENTIFIER &&
        process.env.APPLE_TEAM_IDENTIFIER &&
        process.env.APPLE_PASS_SIGNER_CERT_BASE64 &&
        process.env.APPLE_PASS_SIGNER_KEY_BASE64 &&
        process.env.APPLE_WWDR_CERT_BASE64
    );
    const googleReady = !!(
        process.env.GOOGLE_WALLET_ISSUER_ID &&
        (process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY)
    );

    return {
        apple: appleReady,
        google: googleReady,
        visualCard: true,
        walletPassUrl: (ciData.walletPassUrl as string) || null,
        walletCardUrl: (ciData.walletCardUrl as string) || null,
    };
}
