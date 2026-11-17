import { BaseRepository } from './base.repository.js';
import type { SubscriptionTier } from '../services/subscription/subscription.service.js';

export interface UserRecord {
    id: string;
    email: string;
    company_email?: string | null;
    tier: SubscriptionTier;
    last_login?: string | null;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export class UserRepository extends BaseRepository<UserRecord> {
    constructor() {
        super('users');
    }

    async findByEmail(email: string): Promise<UserRecord | null> {
        return this.findOne({ email } as Partial<UserRecord>);
    }

    async findById(id: string): Promise<UserRecord | null> {
        return this.findOne({ id } as Partial<UserRecord>);
    }

    async findByEmailOrCompanyEmail(email: string): Promise<UserRecord | null> {
        const normalized = email.trim().toLowerCase();
        const { data, error } = await this.db
            .from(this.tableName)
            .select('*')
            .or(`email.ilike.${normalized},company_email.ilike.${normalized}`)
            .maybeSingle();

        if (error) throw error;
        return data as UserRecord | null;
    }

    async updateLastLogin(id: string): Promise<void> {
        await this.update({ id } as Partial<UserRecord>, {
            last_login: new Date().toISOString(),
        } as Partial<UserRecord>);
    }

    async updateTier(id: string, tier: SubscriptionTier): Promise<void> {
        await this.update({ id } as Partial<UserRecord>, {
            tier,
        } as Partial<UserRecord>);
    }
}

export const userRepository = new UserRepository();
