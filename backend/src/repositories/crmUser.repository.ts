import { BaseRepository } from './base.repository.js';

export interface CrmUserRecord {
    email: string;
    company_application_email?: string;
    user_id?: string;
    credits_remaining?: number;
    is_active?: boolean;
    added_by?: string;
    lead_name?: string;
    user_created_at?: string;
    last_sync_at?: string;
    payment_details?: Record<string, unknown>;
    [key: string]: unknown;
}

export class CrmUserRepository extends BaseRepository<CrmUserRecord> {
    constructor() {
        super('digital_resume_by_crm');
    }

    async findByEmail(email: string): Promise<CrmUserRecord | null> {
        return this.findOne({ email } as Partial<CrmUserRecord>);
    }

    async findByEmailOrAppEmail(email: string): Promise<CrmUserRecord | null> {
        const { data, error } = await this.db
            .from(this.tableName)
            .select('*')
            .or(`email.eq.${email},company_application_email.eq.${email}`)
            .maybeSingle();
        if (error) throw error;
        return data as CrmUserRecord | null;
    }
}

export const crmUserRepository = new CrmUserRepository();