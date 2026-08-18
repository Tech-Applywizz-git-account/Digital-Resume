/**
 * Subscription Tier Types
 * ------------------------------------------------------------------
 * Foundation-only types for the new 3-tier subscription architecture.
 *
 * NOTE: Only two tiers are fully specified today:
 *   - "digital_resume"    (Tier 1)
 *   - "career_identity"   (Tier 2)
 *
 * A third tier is planned but not yet defined. `SubscriptionTier` is a
 * string union so adding it later (e.g. "career_identity_pro") only
 * requires extending this union + TIER_FEATURES below — no other file
 * needs structural changes.
 */

export type SubscriptionTier = "digital_resume" | "career_identity";

/** One append-only entry stored in profiles.tier_change_logs (JSONB array). */
export interface TierChangeLogEntry {
    id: string;
    operation: "tier_switch";
    from_tier: string;
    to_tier: SubscriptionTier;
    changed_by_email: string;
    changed_by_user_id: string | null;
    reason: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
}

/** Flattened log row for the admin Tier Logs tab. */
export interface TierChangeLogRow extends TierChangeLogEntry {
    user_id: string;
    user_email: string;
    full_name: string | null;
    current_tier: string | null;
}

/** Fallback tier for any resume/profile without an explicit subscription row. */
export const DEFAULT_SUBSCRIPTION_TIER: SubscriptionTier = "digital_resume";

/** Mirrors the `resume_subscriptions` table. */
export interface ResumeSubscription {
    id: string;
    resumeId: string;
    userId: string | null;
    tier: SubscriptionTier;
    source: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * Feature flags per tier. Used to gate UI/behavior (e.g. whether the
 * "Play Intro" button opens the embedded panel vs. the Career Identity page).
 * Kept intentionally flat/explicit rather than clever inheritance so it is
 * easy to scan and safe to extend when Tier 3 is defined.
 */
export interface TierFeatureSet {
    digitalResume: boolean;
    aiLetsTalk: boolean;
    introVideo: boolean;
    shareProfile: boolean;
    qrCode: boolean;
    appleWallet: boolean;
    engagementAnalytics: boolean;
    careerIdentity: boolean;
}

export const TIER_FEATURES: Record<SubscriptionTier, TierFeatureSet> = {
    digital_resume: {
        digitalResume: true,
        aiLetsTalk: true,
        introVideo: true,
        shareProfile: true,
        qrCode: true,
        appleWallet: false,
        engagementAnalytics: true,
        careerIdentity: false,
    },
    career_identity: {
        digitalResume: true,
        aiLetsTalk: true,
        introVideo: true,
        shareProfile: true,
        qrCode: true,
        appleWallet: true,
        engagementAnalytics: true,
        careerIdentity: true,
    },
};