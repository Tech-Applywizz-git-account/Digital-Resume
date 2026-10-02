import { BaseRepository } from './base.repository.js';

export interface ProfileRecord {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
    full_name?: string;
    phone?: string;
    location?: string;
    job_title?: string;
    company?: string;
    bio?: string;
    credits_remaining?: number;
    plan_renews_at?: string;
    tier?: string;
    career_identity_data?: Record<string, unknown> | null;
    /** Append-only JSONB array of tier switch operations. */
    tier_change_logs?: unknown[];
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export class ProfileRepository extends BaseRepository<ProfileRecord> {
    constructor() {
        super('profiles');
    }

    async findByEmail(email: string): Promise<ProfileRecord | null> {
        return this.findOne({ email } as Partial<ProfileRecord>);
    }

    async findById(id: string): Promise<ProfileRecord | null> {
        return this.findOne({ id } as Partial<ProfileRecord>);
    }

    async findByIds(ids: string[]): Promise<ProfileRecord[]> {
        const { data, error } = await this.db
            .from(this.tableName)
            .select('id, email, full_name, first_name, last_name, credits_remaining')
            .in('id', ids);
        if (error) throw error;
        return (data || []) as ProfileRecord[];
    }
}

export const profileRepository = new ProfileRepository();