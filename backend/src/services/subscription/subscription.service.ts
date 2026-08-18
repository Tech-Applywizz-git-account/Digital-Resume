import { profileRepository, type ProfileRecord } from '../../repositories/profile.repository.js';
import { jobRequestRepository } from '../../repositories/jobRequest.repository.js';
import { crmJobRequestRepository } from '../../repositories/crmJobRequest.repository.js';
import { crmUserRepository, type CrmUserRecord } from '../../repositories/crmUser.repository.js';
import { getDatabase } from '../../config/database.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../types/errors.js';
import { logger } from '../../logger/index.js';
import { randomUUID } from 'node:crypto';

export const DEFAULT_SUBSCRIPTION_TIER = 'digital_resume';

const VALID_TIERS = ['digital_resume', 'career_identity'] as const;
export type SubscriptionTier = (typeof VALID_TIERS)[number];

export interface TierChangeLogEntry {
    id: string;
    operation: 'tier_switch';
    from_tier: string;
    to_tier: SubscriptionTier;
    changed_by_email: string;
    changed_by_user_id: string | null;
    reason: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
}

export interface TierChangeLogRow extends TierChangeLogEntry {
    user_id: string;
    user_email: string;
    full_name: string | null;
    current_tier: string | null;
}

/**
 * Validates a tier value. Returns null for any invalid/missing value.
 */
function validateTier(raw: unknown): SubscriptionTier | null {
    if (typeof raw === 'string' && (VALID_TIERS as readonly string[]).includes(raw)) {
        return raw as SubscriptionTier;
    }
    return null;
}

function asLogArray(raw: unknown): TierChangeLogEntry[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((item) => item && typeof item === 'object') as TierChangeLogEntry[];
}

async function verifyAdmin(email: string): Promise<void> {
    const db = getDatabase();
    const { data } = await db
        .from('crm_admins')
        .select('email')
        .eq('email', email)
        .maybeSingle();

    if (!data) {
        throw new ForbiddenError('Admin access required');
    }
}

export class SubscriptionService {
    /**
     * Resolves the tier for a specific resume (castId).
     * Finds the resume owner, then reads profiles.tier.
     */
    async getTier(resumeId: string): Promise<string | null> {
        const [crmJob, regularJob] = await Promise.all([
            crmJobRequestRepository.findOne({ id: resumeId } as any),
            jobRequestRepository.findOne({ id: resumeId } as any),
        ]);
        const record = crmJob || regularJob;
        if (!record || !record.user_id) {
            return null;
        }
        const profile = await profileRepository.findById(record.user_id);
        const validated = validateTier(profile?.tier);
        return validated ?? DEFAULT_SUBSCRIPTION_TIER;
    }

    /**
     * Resolves the effective tier for an authenticated user.
     * Reads profiles.tier for the given userId.
     * Unset/invalid tier falls back to DEFAULT_SUBSCRIPTION_TIER when the user
     * has a profile or a CRM purchase record; otherwise null (no product access).
     */
    async getEffectiveUserTier(userId: string): Promise<{ tier: string | null }> {
        const profile = await profileRepository.findById(userId);
        const validated = validateTier(profile?.tier);
        if (validated) {
            return { tier: validated };
        }

        if (profile) {
            return { tier: DEFAULT_SUBSCRIPTION_TIER };
        }

        const crmUser = await crmUserRepository.findOne({ user_id: userId } as Partial<CrmUserRecord>);
        if (crmUser) {
            return { tier: DEFAULT_SUBSCRIPTION_TIER };
        }

        return { tier: null };
    }

    /**
     * Admin: switch a user's profiles.tier and APPEND a JSONB log entry
     * onto that same profile row (profiles.tier_change_logs).
     */
    async switchUserTier(params: {
        adminEmail: string;
        adminUserId: string | null;
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
        await verifyAdmin(params.adminEmail);

        const profile = await this.resolveTargetProfile(params.userId, params.email);

        const fromTier = validateTier(profile.tier) ?? 'unset';
        if (fromTier === params.toTier) {
            throw new ConflictError(`User is already on ${params.toTier}`);
        }

        const crm = await this.lookupCrm(profile.id, profile.email);
        const ciData = (profile.career_identity_data as Record<string, unknown> | null) || null;

        const entry: TierChangeLogEntry = {
            id: randomUUID(),
            operation: 'tier_switch',
            from_tier: fromTier,
            to_tier: params.toTier,
            changed_by_email: params.adminEmail.toLowerCase(),
            changed_by_user_id: params.adminUserId,
            reason: params.reason?.trim() || null,
            metadata: {
                crm_email: crm?.email ?? null,
                company_application_email: crm?.company_application_email ?? null,
                previous_ci_status: ciData?.status ?? null,
                previous_ci_workflow: ciData?.workflowStatus ?? null,
            },
            created_at: new Date().toISOString(),
        };

        const logs = await this.appendLog(profile.id, params.toTier, entry);

        logger.info({
            event: 'admin_tier_switch',
            userId: profile.id,
            email: profile.email,
            fromTier,
            toTier: params.toTier,
            changedBy: params.adminEmail,
            logId: entry.id,
        }, 'Admin switched subscription tier');

        return {
            userId: profile.id,
            email: profile.email,
            fromTier,
            toTier: params.toTier,
            logs,
            entry,
        };
    }

    /**
     * Admin: return flattened JSONB log entries (newest first).
     * If userId/email is set, only that user's array is returned.
     */
    async listTierLogs(params: {
        adminEmail: string;
        userId?: string;
        email?: string;
    }): Promise<TierChangeLogRow[]> {
        await verifyAdmin(params.adminEmail);
        const db = getDatabase();

        let query = db
            .from('profiles')
            .select('id, email, full_name, tier, tier_change_logs');

        if (params.userId) {
            query = query.eq('id', params.userId);
        } else if (params.email) {
            query = query.ilike('email', params.email);
        } else {
            query = query.contains('tier_change_logs', [{ operation: 'tier_switch' }]);
        }

        const { data, error } = await query;
        if (error) throw error;

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
    }

    private async resolveTargetProfile(userId?: string, email?: string): Promise<ProfileRecord> {
        const normalizedEmail = email?.toLowerCase().trim();

        if (userId) {
            const byId = await profileRepository.findById(userId);
            if (byId) return byId;
        }

        if (normalizedEmail) {
            const byEmail = await profileRepository.findByEmail(normalizedEmail);
            if (byEmail) return byEmail;

            const crm = await crmUserRepository.findByEmailOrAppEmail(normalizedEmail);
            if (crm?.user_id) {
                const byCrmId = await profileRepository.findById(crm.user_id);
                if (byCrmId) return byCrmId;

                return this.createProfileForCrmUser(crm, normalizedEmail);
            }
        }

        if (userId) {
            const crmById = await crmUserRepository.findOne({ user_id: userId } as Partial<CrmUserRecord>);
            if (crmById) {
                return this.createProfileForCrmUser(crmById, crmById.email);
            }
        }

        throw new NotFoundError('Profile', userId || email);
    }

    private async createProfileForCrmUser(crm: CrmUserRecord, email: string): Promise<ProfileRecord> {
        if (!crm.user_id) {
            throw new ValidationError([{
                path: 'userId',
                message: 'This CRM user has no linked account, so a tier cannot be assigned.',
            }]);
        }

        const db = getDatabase();
        const { data, error } = await db
            .from('profiles')
            .insert({
                id: crm.user_id,
                email: email.toLowerCase(),
                tier: DEFAULT_SUBSCRIPTION_TIER,
                tier_change_logs: [],
            })
            .select()
            .single();

        if (error) {
            const existing = await profileRepository.findById(crm.user_id);
            if (existing) return existing;
            throw error;
        }

        return data as ProfileRecord;
    }

    private async lookupCrm(userId: string, email: string): Promise<CrmUserRecord | null> {
        const byId = await crmUserRepository.findOne({ user_id: userId } as Partial<CrmUserRecord>);
        if (byId) return byId;
        return crmUserRepository.findByEmailOrAppEmail(email);
    }

    private async appendLog(
        userId: string,
        toTier: SubscriptionTier,
        entry: TierChangeLogEntry,
    ): Promise<TierChangeLogEntry[]> {
        const db = getDatabase();

        const { data: rpcLogs, error: rpcError } = await db.rpc('append_tier_change_log', {
            p_user_id: userId,
            p_new_tier: toTier,
            p_entry: entry,
        });

        if (!rpcError && rpcLogs) {
            return asLogArray(rpcLogs);
        }

        logger.warn({ err: rpcError, userId }, 'append_tier_change_log RPC unavailable; appending in application code');

        const profile = await profileRepository.findById(userId);
        if (!profile) throw new NotFoundError('Profile', userId);

        const nextLogs = [...asLogArray(profile.tier_change_logs), entry];
        const { data, error } = await db
            .from('profiles')
            .update({
                tier: toTier,
                tier_change_logs: nextLogs,
            })
            .eq('id', userId)
            .select('tier_change_logs')
            .single();

        if (error) {
            const msg = String(error.message || '');
            if (msg.includes('tier_change_logs') || error.code === '42703') {
                throw new ValidationError([{
                    path: 'tier_change_logs',
                    message: 'profiles.tier_change_logs column is missing. Run supabase-functions/migrations/add_tier_change_logs.sql in the Supabase SQL editor.',
                }]);
            }
            throw error;
        }
        return asLogArray(data?.tier_change_logs);
    }
}

export const subscriptionService = new SubscriptionService();
