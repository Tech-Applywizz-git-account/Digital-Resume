import { supabase } from '../../integrations/supabase/client';
import { apiUrl } from '../../lib/apiBase';

export type AdminRole = 'admin' | 'super_admin';
export interface AdminAccount { email: string; role: AdminRole; created_at: string }

export async function adminRequest<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
    const accessToken = token ?? (await supabase.auth.getSession()).data.session?.access_token;
    if (!accessToken) throw new Error('Sign in to continue.');
    const response = await fetch(apiUrl(`/api/v1/admin${path}`), {
        ...init,
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || !body || !('data' in body)) {
        throw new Error(body?.error?.message || body?.message || `Unable to load admin data (${response.status}).`);
    }
    return body.data;
}

export const getAdminRole = async (token?: string) =>
    (await adminRequest<{ role: AdminRole | null }>('/me', undefined, token)).role;

export const adminDestination = (role: AdminRole) =>
    role === 'super_admin' ? '/admin/overview' : '/digital-resume-dashboard';
