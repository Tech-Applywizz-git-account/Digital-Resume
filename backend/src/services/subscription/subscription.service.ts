import { profileRepository } from '../../repositories/profile.repository.js';
import { jobRequestRepository } from '../../repositories/jobRequest.repository.js';
import { crmJobRequestRepository } from '../../repositories/crmJobRequest.repository.js';
import { crmUserRepository, type CrmUserRecord } from '../../repositories/crmUser.repository.js';

export const DEFAULT_SUBSCRIPTION_TIER = 'digital_resume';

const VALID_TIERS = ['digital_resume', 'career_identity'];

/**
 * Validates a tier value. Returns null for any invalid/missing value.
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
        const validated = validateTier(profile?.tier);
        // Resume-level: match edge-function behavior — unset tier means Tier 1
        return validated ?? DEFAULT_SUBSCRIPTION_TIER;
    }

    /**
     * Resolves the effective tier for an authenticated user.
     * Reads profiles.tier for the given userId.
     * Unset/invalid tier falls back to DEFAULT_SUBSCRIPTION_TIER when the user
     * has a profile or a CRM purchase record; otherwise null (no product access).
     */
    async getEffectiveUserTier(userId: string): Promise<{ tier: string | null }> {
        const profile = await profileRepository.findById(userId);
        const validated = validateTier(profile?.tier);
        if (validated) {
            // #region agent log
            fetch('http://127.0.0.1:7399/ingest/b70637ca-c578-4c1f-a48f-92fd78054009',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bcdd5'},body:JSON.stringify({sessionId:'8bcdd5',runId:'post-fix',hypothesisId:'C',location:'subscription.service.ts:getEffectiveUserTier',message:'Returning explicit profiles.tier',data:{userId,tier:validated,hasProfile:!!profile},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            return { tier: validated };
        }

        if (profile) {
            // #region agent log
            fetch('http://127.0.0.1:7399/ingest/b70637ca-c578-4c1f-a48f-92fd78054009',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bcdd5'},body:JSON.stringify({sessionId:'8bcdd5',runId:'post-fix',hypothesisId:'C',location:'subscription.service.ts:getEffectiveUserTier',message:'Profile exists with unset tier; defaulting to digital_resume',data:{userId,rawTier:profile?.tier??null},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            return { tier: DEFAULT_SUBSCRIPTION_TIER };
        }

        const crmUser = await crmUserRepository.findOne({ user_id: userId } as Partial<CrmUserRecord>);
        if (crmUser) {
            // #region agent log
            fetch('http://127.0.0.1:7399/ingest/b70637ca-c578-4c1f-a48f-92fd78054009',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bcdd5'},body:JSON.stringify({sessionId:'8bcdd5',runId:'post-fix',hypothesisId:'C',location:'subscription.service.ts:getEffectiveUserTier',message:'CRM user without profile.tier; defaulting to digital_resume',data:{userId},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            return { tier: DEFAULT_SUBSCRIPTION_TIER };
        }

        // #region agent log
        fetch('http://127.0.0.1:7399/ingest/b70637ca-c578-4c1f-a48f-92fd78054009',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8bcdd5'},body:JSON.stringify({sessionId:'8bcdd5',runId:'post-fix',hypothesisId:'C',location:'subscription.service.ts:getEffectiveUserTier',message:'No profile/CRM — null tier',data:{userId},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return { tier: null };
    }
}

export const subscriptionService = new SubscriptionService();