import { createClient } from '@supabase/supabase-js';

export function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anonKey, serviceKey };
}

export function createAnonClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAdminClient(url, serviceKey) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Verifies Bearer token and returns { user, admin } or writes an error response.
 * Returns null when the response has already been sent.
 */
export async function requireAuth(req, res) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return null;
  }

  const { url, anonKey, serviceKey } = getSupabaseEnv();
  if (!url || !anonKey || !serviceKey) {
    res.status(500).json({ success: false, message: 'Server misconfigured' });
    return null;
  }

  const token = authHeader.slice(7);
  const anon = createAnonClient(url, anonKey);
  const { data: userData, error } = await anon.auth.getUser(token);
  if (error || !userData?.user?.id) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
    return null;
  }

  return {
    user: {
      id: userData.user.id,
      email: userData.user.email || '',
    },
    admin: createAdminClient(url, serviceKey),
  };
}

export function setCors(res, methods = 'GET, POST, PUT, OPTIONS') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
