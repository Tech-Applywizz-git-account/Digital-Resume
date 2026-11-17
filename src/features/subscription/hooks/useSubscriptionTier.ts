import { useEffect, useState } from "react";
import { SubscriptionTier } from "../../../types/subscription";
import { getMyTier } from "../services/subscriptionService";

export interface UseSubscriptionTierResult {
    tier: SubscriptionTier | null;
    loading: boolean;
}

/**
 * Resolves the authenticated user's effective subscription tier.
 * Uses GET /api/v1/subscription/me backed by profiles.tier.
 * Returns null when the customer has no product access.
 */
export const useSubscriptionTier = (
    _resumeId: string | null | undefined
): UseSubscriptionTierResult => {
    const [tier, setTier] = useState<SubscriptionTier | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        getMyTier().then((resolvedTier) => {
            if (!cancelled) {
                setTier(resolvedTier);
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return { tier, loading };
};
