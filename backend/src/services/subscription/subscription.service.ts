import { profileRepository } from '../../repositories/profile.repository.js';
import { jobRequestRepository } from '../../repositories/jobRequest.repository.js';
import { crmJobRequestRepository } from '../../repositories/crmJobRequest.repository.js';

export const DEFAULT_SUBSCRIPTION_TIER = 'digital_resume';

const VALID_TIERS = ['digital_resume', 'career_identity'];

/**
 * Validates a tier value. Returns null for any invalid/missing value.
 * NULL means the customer has no product access.
 */
function validateTier(raw: unknown): string | null {
    if (typeof raw === 'string' && VALID_TIERS.includes(raw)) {
        return raw;
    }
    return null;
}

export class SubscriptionService {
    /**
     * Resolves the tier for a specific resume (castId).
     * Finds the resume owner, then reads profiles.tier.
     */
    async getTier(resumeId: string): Promise<string | null> {
        const [crmJob, regularJob] = await Promise.all([
            crmJobRequestRepository.findOne({ id: resumeId } as any),
            jobRequestRepository.findOne({ id: resumeId } as any),
        ]);
        const record = crmJob || regularJob;
        if (!record || !record.user_id) {
            return null;
        }
        const profile = await profileRepository.findById(record.user_id);
        return validateTier(profile?.tier);
    }

    /**
     * Resolves the effective tier for an authenticated user.
     * Reads profiles.tier for the given userId.
     * Returns null when the customer has no product access.
     */
    async getEffectiveUserTier(userId: string): Promise<{ tier: string | null }> {
        const profile = await profileRepository.findById(userId);
        return { tier: validateTier(profile?.tier) };
    }
}

export const subscriptionService = new SubscriptionService();