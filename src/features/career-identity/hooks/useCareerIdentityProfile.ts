import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthContext } from "../../../contexts/AuthContext";
import {
    CareerIdentityDerivedData,
    CareerIdentityProfile,
    CareerIdentityUpdatePayload,
} from "../../../types/careerIdentity";
import { SubscriptionTier, DEFAULT_SUBSCRIPTION_TIER } from "../../../types/subscription";
import {
    fetchCareerIdentityProfile,
    fetchMyCareerIdentityProfile,
    updateCareerIdentityProfile,
} from "../services/careerIdentityService";

export interface UseCareerIdentityProfileResult {
    profile: CareerIdentityProfile | null;
    /** Candidate name / resume / video / portfolio — resolved live, never duplicated. */
    derived: CareerIdentityDerivedData | null;
    tier: SubscriptionTier;
    loading: boolean;
    error: string | null;
    /** True while a PATCH triggered by updateProfile() is in flight. */
    updating: boolean;
    /** Re-fetches the profile + derived data from scratch. */
    refresh: () => Promise<void>;
    /** Partially updates Career-Identity-only content (about, education, etc.). */
    updateProfile: (updates: CareerIdentityUpdatePayload) => Promise<boolean>;
}

export const useCareerIdentityProfile = (
    resumeId: string | null | undefined
): UseCareerIdentityProfileResult => {
    const { user } = useAuthContext();
    const [profile, setProfile] = useState<CareerIdentityProfile | null>(null);
    const [derived, setDerived] = useState<CareerIdentityDerivedData | null>(null);
    const [tier, setTier] = useState<SubscriptionTier>(DEFAULT_SUBSCRIPTION_TIER);
    const [loading, setLoading] = useState<boolean>(!!resumeId);
    const [updating, setUpdating] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Tracks the "current" request so a slow, stale request can't clobber
    // state after a newer one (or an unmount) has already happened.
    const requestIdRef = useRef(0);

    const load = useCallback(async () => {
        if (!resumeId) {
            setLoading(false);
            return;
        }

        const thisRequestId = ++requestIdRef.current;
        setLoading(true);
        setError(null);

        try {
            // Authenticated users (owner in dashboard) use the authenticated endpoint
            // which supports ownership checks and returns draft profiles.
            // Unauthenticated users (recruiters) use the public endpoint.
            const response = user?.id
                ? await fetchMyCareerIdentityProfile(resumeId, user.id)
                : await fetchCareerIdentityProfile(resumeId, null);
            if (requestIdRef.current !== thisRequestId) return; // stale, ignore
            setTier(response.tier);
            setProfile(response.profile);
            setDerived(response.derived);
        } catch (err) {
            if (requestIdRef.current !== thisRequestId) return;
            console.error("[useCareerIdentityProfile] Failed to load profile:", err);
            setError(err instanceof Error ? err.message : "Failed to load profile");
        } finally {
            if (requestIdRef.current === thisRequestId) setLoading(false);
        }
    }, [resumeId, user?.id]);

    useEffect(() => {
        load();
        // load() itself is recreated whenever resumeId/user?.id change, so this
        // effect re-runs exactly when it needs to.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resumeId, user?.id]);

    const updateProfile = useCallback(
        async (updates: CareerIdentityUpdatePayload): Promise<boolean> => {
            if (!resumeId) return false;

            setUpdating(true);
            setError(null);

            try {
                const response = await updateCareerIdentityProfile(resumeId, updates, user?.id ?? null);
                setTier(response.tier);
                setProfile(response.profile);
                setDerived(response.derived);
                return true;
            } catch (err) {
                console.error("[useCareerIdentityProfile] Failed to update profile:", err);
                setError(err instanceof Error ? err.message : "Failed to update profile");
                return false;
            } finally {
                setUpdating(false);
            }
        },
        [resumeId, user?.id]
    );

    return { profile, derived, tier, loading, error, updating, refresh: load, updateProfile };
};