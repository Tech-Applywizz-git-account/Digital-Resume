import { supabase } from '../../../integrations/supabase/client';
import { apiUrl } from '../../../lib/apiBase';
import type { SubscriptionTier, TierChangeLogEntry, TierChangeLogRow } from '../../../types/subscription';

async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
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

export async function fetchTierLogs(params?: {
    email?: string;
    userId?: string;
}): Promise<TierChangeLogRow[]> {
    const headers = await authHeaders();
    const query = new URLSearchParams();
    if (params?.email) query.set('email', params.email);
    if (params?.userId) query.set('userId', params.userId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(apiUrl(`/api/v1/subscription/admin/tier-logs${suffix}`), {
        headers: { ...headers, 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(await readError(res));
    const body = await res.json();
    return body.data || [];
}
