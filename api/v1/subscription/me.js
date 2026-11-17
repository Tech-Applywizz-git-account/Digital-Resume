import { requireAuth, setCors } from '../../../lib/supabaseAuth.js';

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
  setCors(res, 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const { user, admin } = auth;
    const { data: profile } = await admin
      .from('profiles')
      .select('tier')
      .eq('id', user.id)
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
      .eq('user_id', user.id)
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
