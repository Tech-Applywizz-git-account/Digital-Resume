import { adminDestination, getAdminRole } from '../features/admin/adminApi';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { apiUrl } from '../lib/apiBase';

export async function resolveSignedInDestination(session: Session): Promise<string> {
  const email = session.user.email?.trim().toLowerCase();
  const role = await getAdminRole(session.access_token);
  if (role) {
    sessionStorage.setItem('digital_resume_admin_access', 'true');
    if (email) sessionStorage.setItem('admin_email', email);
    return adminDestination(role);
  }
  sessionStorage.removeItem('digital_resume_admin_access');
  sessionStorage.removeItem('admin_email');

  try {
    const response = await fetch(apiUrl('/api/v1/subscription/me'), {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (response.ok) {
      const body = await response.json();
      const tier = body?.data?.tier;
      if (tier === 'career_identity') return '/career-identity-dashboard';
      if (tier === 'digital_resume') return '/dashboard';
    }
  } catch (error) {
    console.warn('Tier resolution failed:', error);
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', session.user.id)
      .maybeSingle();
    if (profile?.tier === 'career_identity') return '/career-identity-dashboard';
    if (profile) return '/dashboard';
  } catch (error) {
    console.warn('Profile tier lookup failed:', error);
  }

  return localStorage.getItem('is_crm_user') === 'true' ? '/dashboard' : '/';
}
