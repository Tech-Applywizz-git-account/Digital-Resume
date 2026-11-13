/**
 * Career Identity Service
 * ------------------------------------------------------------------
 * Talks to the backend API at /api/v1/career-identity/profile, which
 * resolves the subscription tier, reads/writes profiles.career_identity_data,
 * and resolves derived data (candidate name, resume/video/portfolio URLs)
 * live from existing tables — never duplicated.
 *
 * Supports partial updates to Career-Identity-only content via PATCH.
 */

import {
    CareerIdentityClarityConfig,
    CareerIdentityProfileResponse,
    CareerIdentityUpdatePayload,
} from "../../../types/careerIdentity";
import { supabase } from "../../../integrations/supabase/client";
import { apiUrl } from "../../../lib/apiBase";

const API_BASE = apiUrl("/api/v1/career-identity");

/**
 * Builds the Authorization header with the current Supabase session token.
 */
async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Fetches a Career Identity profile for public viewing.
 * Always uses the public endpoint — no authentication required.
 * This is the correct endpoint for /career-identity/:castId,
 * which must be accessible to recruiters, owners, and any other
 * visitor with the share link.
 */
export const fetchCareerIdentityProfile = async (
    resumeId: string,
    _userId?: string | null
): Promise<CareerIdentityProfileResponse> => {
    const res = await fetch(`${API_BASE}/profile/public/${encodeURIComponent(resumeId)}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
        throw new Error(`Failed to load Career Identity profile (${res.status})`);
    }

    const body = await res.json();
    return body.data;
};

/**
 * Fetches a Career Identity profile for the authenticated owner.
 * Requires authentication and ownership verification.
 * Used by the dashboard for owner-only operations (editing, viewing drafts).
 */
export const fetchMyCareerIdentityProfile = async (
    resumeId: string,
    userId: string
): Promise<CareerIdentityProfileResponse> => {
    const params = new URLSearchParams({ resume_id: resumeId, user_id: userId });
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/profile?${params.toString()}`, {
        method: "GET",
        headers: { ...headers, "Content-Type": "application/json" },
    });

    if (!res.ok) {
        throw new Error(`Failed to load Career Identity profile (${res.status})`);
    }

    const body = await res.json();
    return body.data;
};

/**
 * Downloads a branded PNG wallet card for NeatPass import into Apple Wallet.
 * The user can then upload this PNG to NeatPass (free) to create a pass.
 */
export const downloadWalletCard = async (castId: string): Promise<Blob> => {
    const res = await fetch(apiUrl(`/api/v1/wallet/${encodeURIComponent(castId)}/card`), {
        method: 'GET',
        headers: { ...(await authHeaders()) },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || `Failed to generate wallet card (${res.status})`);
    }

    return res.blob();
};

export const fetchWalletStatus = async (castId: string): Promise<{
    apple: boolean;
    google: boolean;
    visualCard: boolean;
    walletPassUrl: string | null;
    walletCardUrl: string | null;
}> => {
    const res = await fetch(apiUrl(`/api/v1/wallet/${encodeURIComponent(castId)}/status`), {
        method: 'GET',
        headers: { ...(await authHeaders()) },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || `Failed to load wallet status (${res.status})`);
    }

    const body = await res.json();
    return body.data;
};

export const fetchGoogleWalletUrl = async (castId: string): Promise<string> => {
    const res = await fetch(apiUrl(`/api/v1/wallet/${encodeURIComponent(castId)}/google-wallet`), {
        method: 'GET',
        headers: { ...(await authHeaders()) },
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || `Failed to generate Google Wallet link (${res.status})`);
    }

    const body = await res.json();
    return body?.data?.saveUrl;
};

export const getAppleWalletPassUrl = (castId: string): string =>
    apiUrl(`/api/v1/wallet/${encodeURIComponent(castId)}/apple-wallet-pass`);

export const updateCareerIdentityProfile = async (
    resumeId: string,
    updates: CareerIdentityUpdatePayload & { workflowStatus?: string },
    userId?: string | null
): Promise<CareerIdentityProfileResponse> => {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/profile`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
            resume_id: resumeId,
            user_id: userId ?? undefined,
            ...updates,
        }),
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || body?.message || `Failed to update Career Identity profile (${res.status})`);
    }

    const body = await res.json();
    return body.data;
};
export interface EligibleResume {
    castId: string;
    source: string;
    recordingNumber: number;
    createdAt: string;
    recordingId: string;
    resumeUrl: string;
    videoUrl: string;
}

export interface PublishedAppearance {
    submissionId: string;
    themeId: 'aurora' | 'zenith' | 'atlas';
    avatar: string | null;
}

export type SubmissionRecording = { number: number; createdAt: string };

export interface CareerIdentityDashboardData {
    publishedRecording?: SubmissionRecording | null;
    appearance?: PublishedAppearance | null;
    summary?: { name: string | null; email: string | null };
    eligible: EligibleResume[];
    publishedId: string | null;
    workflowStatus: string;
    pending: { id: string; castId: string; submittedAt: string; recording?: SubmissionRecording | null; resumeUrl: string; videoUrl: string } | null;
    clarity: CareerIdentityClarityConfig | null;
}

async function dashboardRequest<T>(path: string, method = 'GET', payload?: object): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { ...await authHeaders(), 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = body.error?.message || body.message || 'Unable to complete your Career Identity request.';
        throw new Error(response.status >= 500 && body.requestId ? `${message} Reference: ${body.requestId}` : message);
    }
    return body.data;
}

export const fetchCareerIdentityDashboard = () => dashboardRequest<CareerIdentityDashboardData>('/dashboard');
export const submitCareerIdentity = (selection: EligibleResume, idempotencyKey: string, expectedPendingId: string | null) =>
    dashboardRequest('/submissions', 'POST', { ...selection, idempotencyKey, expectedPendingId });
export const withdrawCareerIdentitySubmission = (submissionId: string) =>
    dashboardRequest<void>(`/submissions/${encodeURIComponent(submissionId)}`, 'DELETE');
export const updateCareerIdentityConsent = (accepted: boolean) =>
    dashboardRequest('/consent', 'PATCH', { accepted });

export const fetchCareerIdentityViewer = () => dashboardRequest<{ isAdmin: boolean }>('/viewer');

export const savePublishedAppearance = (appearance: Omit<PublishedAppearance, 'avatar'> & { avatar?: string | null }) =>
    dashboardRequest<void>('/appearance', 'PATCH', appearance);
