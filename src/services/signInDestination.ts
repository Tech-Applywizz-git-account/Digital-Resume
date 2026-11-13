import type { Session } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import { apiUrl } from '../lib/apiBase';

export async function resolveSignedInDestination(session: Session): Promise<string> {
  const email = session.user.email?.trim().toLowerCase();
  if (email) {
    try {
      const { data: admin } = await supabase
        .from('crm_admins')
        .select('email')
        .ilike('email', email)
        .maybeSingle();

      if (admin || email === 'dinesh@applywizz.com') {
        sessionStorage.setItem('digital_resume_admin_access', 'true');
        sessionStorage.setItem('admin_email', email);
        return '/digital-resume-dashboard';
      }
    } catch (error) {
      console.warn('Admin check failed, proceeding to customer tier lookup:', error);
    }
  }

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
