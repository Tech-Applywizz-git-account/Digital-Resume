/**
 * Subscription Service
 * ------------------------------------------------------------------
 * Resolves the authenticated customer's subscription tier through the
 * backend API endpoint GET /api/v1/subscription/me.
 *
 * Tier is determined server-side from profiles.tier.
 * Values: "digital_resume" | "career_identity" | null (null = no product)
 */
import { supabase } from "../../../integrations/supabase/client";
import {
    DEFAULT_SUBSCRIPTION_TIER,
    SubscriptionTier,
} from "../../../types/subscription";

/**
 * Returns the authenticated customer's effective subscription tier.
 * Returns null when the customer has no product access.
 */
export const getMyTier = async (): Promise<SubscriptionTier | null> => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
            return null;
        }

        const res = await fetch('/api/v1/subscription/me', {
            headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
            return null;
        }

        const body = await res.json();
        const tier = body?.data?.tier;
        if (tier === 'digital_resume' || tier === 'career_identity') {
            return tier as SubscriptionTier;
        }
        return null;
    } catch {
        return null;
    }
};