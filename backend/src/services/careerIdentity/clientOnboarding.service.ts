/**
 * Client Onboarding Service
 *
 * Integrates with ApplyWizz CRM Tool to fetch client onboarding details (including gender).
 * Provides deterministic and randomized avatar & theme assignment.
 */

import { environment } from '../../config/environment.js';

export const AVAILABLE_THEMES = ['aurora', 'zenith', 'atlas'] as const;
export type CareerIdentityTheme = typeof AVAILABLE_THEMES[number];

export interface ClientOnboardingGenderResult {
    gender: 'Male' | 'Female' | null;
    rawGender: string | null;
}

/**
 * Normalizes and assigns a random avatar based on gender:
 * - 'Male'   -> 1 to 8  (/Avatar_profile/1.jpg - 8.jpg)
 * - 'Female' -> 9 to 16 (/Avatar_profile/9.jpg - 16.jpg)
 * - null     -> null (Leave empty when unknown or API is down)
 */
export function assignRandomAvatar(gender: 'Male' | 'Female' | null): string | null {
    if (gender === 'Male') {
        const num = Math.floor(Math.random() * 8) + 1; // 1 to 8
        return `/Avatar_profile/${num}.jpg`;
    }
    if (gender === 'Female') {
        const num = Math.floor(Math.random() * 8) + 9; // 9 to 16
        return `/Avatar_profile/${num}.jpg`;
    }
    return null; // Left empty if unknown or API down
}

/**
 * Randomly assigns one of the active Career Identity themes: aurora, zenith, or atlas.
 */
export function assignRandomTheme(): CareerIdentityTheme {
    const idx = Math.floor(Math.random() * AVAILABLE_THEMES.length);
    return AVAILABLE_THEMES[idx];
}

/**
 * Queries ApplyWizz CRM Tool for onboarding details (e.g. gender) by email.
 * Tries personal email first, falling back to company application email.
 * Uses a strict 3.5s timeout so requests never hang or block execution.
 */
export async function fetchClientGender(
    personalEmail?: string | null,
    companyEmail?: string | null
): Promise<ClientOnboardingGenderResult> {
    const emailsToTry = Array.from(new Set([personalEmail, companyEmail].filter(Boolean))) as string[];

    for (const email of emailsToTry) {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) continue;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500);

            const baseUrl = (environment.crmBaseUrl || 'https://applywizz-crm-tool.vercel.app').replace(/\/+$/, '');
            const url = `${baseUrl}/api/client-onboarding-details?email=${encodeURIComponent(trimmed)}`;
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (res.ok) {
                const body = (await res.json().catch(() => null)) as any;
                const rawGender = (body?.data?.gender ?? body?.gender ?? null);

                if (rawGender && typeof rawGender === 'string') {
                    const normalized = rawGender.trim().toLowerCase();
                    if (normalized === 'male') {
                        return { gender: 'Male', rawGender };
                    }
                    if (normalized === 'female') {
                        return { gender: 'Female', rawGender };
                    }
                }
            }
        } catch (err: any) {
            console.warn(`[ClientOnboarding] Gender lookup failed for email ${trimmed}:`, err?.message || err);
        }
    }

    return { gender: null, rawGender: null };
}
