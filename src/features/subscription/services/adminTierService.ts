import { supabase } from '../../../integrations/supabase/client';
import { apiUrl } from '../../../lib/apiBase';
import type { SubscriptionTier, TierChangeLogEntry, TierChangeLogRow } from '../../../types/subscription';

async function authHeaders(): Promise<Record<string, string>> {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        const refreshed = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
        session = refreshed.data.session;
    }
    const token = session?.access_token;
    const adminEmail =
        sessionStorage.getItem('admin_email') ||
        session?.user?.email ||
        localStorage.getItem('admin_email') ||
        localStorage.getItem('user_email');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (adminEmail) headers['x-admin-email'] = adminEmail;
    return headers;
}

async function readError(res: Response): Promise<string> {
    const body = await res.json().catch(() => ({} as any));
    return body?.error?.message || body?.message || `Request failed (${res.status})`;
}

export async function switchUserTier(payload: {
    email?: string;
    userId?: string;
    toTier: SubscriptionTier;
    reason?: string;
}): Promise<{
    userId: string;
    email: string;
    fromTier: string;
    toTier: SubscriptionTier;
    logs: TierChangeLogEntry[];
    entry: TierChangeLogEntry;
}> {
    const headers = await authHeaders();
    const res = await fetch(apiUrl('/api/v1/subscription/admin/tier'), {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await readError(res));
    const body = await res.json();
    return body.data;
}

function asLogArray(raw: unknown): TierChangeLogEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => item && typeof item === 'object') as TierChangeLogEntry[];
}

export async function fetchTierLogs(params?: {
    email?: string;
    userId?: string;
}): Promise<TierChangeLogRow[]> {
    try {
        const headers = await authHeaders();
        const query = new URLSearchParams();
        if (params?.email) query.set('email', params.email);
        if (params?.userId) query.set('userId', params.userId);
        const suffix = query.toString() ? `?${query.toString()}` : '';
        const res = await fetch(apiUrl(`/api/v1/subscription/admin/tier-logs${suffix}`), {
            headers: { ...headers, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
            const body = await res.json();
            if (Array.isArray(body?.data)) {
                return body.data;
            }
        }
    } catch (err) {
        console.warn('API tier-logs fetch failed, falling back to direct Supabase query:', err);
    }

    // Direct Supabase fallback: query profiles table directly
    try {
        let query = supabase
            .from('profiles')
            .select('id, email, full_name, tier, tier_change_logs');

        if (params?.userId) {
            query = query.eq('id', params.userId);
        } else if (params?.email) {
            query = query.ilike('email', params.email);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Direct Supabase fetch error for tier-logs:', error);
            return [];
        }

        const rows: TierChangeLogRow[] = [];
        for (const profile of data || []) {
            const logs = asLogArray(profile.tier_change_logs);
            for (const entry of logs) {
                rows.push({
                    ...entry,
                    user_id: profile.id,
                    user_email: profile.email,
                    full_name: profile.full_name ?? null,
                    current_tier: profile.tier ?? null,
                });
            }
        }

        rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return rows;
    } catch (fallbackErr) {
        console.error('Fallback query failed:', fallbackErr);
        return [];
    }
}
