import { createClient } from '@supabase/supabase-js';

const VALID_TIERS = ['digital_resume', 'career_identity'];
const DEFAULT_SUBSCRIPTION_TIER = 'digital_resume';

function validateTier(raw) {
  if (typeof raw === 'string' && VALID_TIERS.includes(raw)) return raw;
  return null;
}

/**
 * GET /api/v1/subscription/me
 * Production Vercel handler mirroring backend SubscriptionService.getEffectiveUserTier.
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  const token = authHeader.slice(7);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !anonKey || !serviceKey) {
    return res.status(500).json({ success: false, message: 'Server misconfigured' });
  }

  try {
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile } = await admin
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .maybeSingle();

    const validated = validateTier(profile?.tier);
    if (validated) {
      return res.status(200).json({ success: true, data: { tier: validated } });
    }

    if (profile) {
      return res.status(200).json({
        success: true,
        data: { tier: DEFAULT_SUBSCRIPTION_TIER },
      });
    }

    const { data: crmUser } = await admin
      .from('digital_resume_by_crm')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (crmUser) {
      return res.status(200).json({
        success: true,
        data: { tier: DEFAULT_SUBSCRIPTION_TIER },
      });
    }

    return res.status(200).json({ success: true, data: { tier: null } });
  } catch (err) {
    console.error('subscription/me error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
