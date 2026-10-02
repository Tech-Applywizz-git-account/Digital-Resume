import { BaseRepository } from './base.repository.js';

export interface CrmResumeRecord {
    id?: string;
    email: string;
    user_id?: string;
    resume_name?: string;
    resume_url?: string;
    file_type?: string;
    file_size?: number;
    parsed_data?: Record<string, unknown>;
    is_primary?: boolean;
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export class CrmResumeRepository extends BaseRepository<CrmResumeRecord> {
    constructor() {
        super('crm_resumes');
    }

    async findByEmail(email: string): Promise<CrmResumeRecord[]> {
        return this.findMany(
            { email } as Partial<CrmResumeRecord>,
            { orderBy: 'created_at', orderDirection: 'desc' },
        );
    }
}

export const crmResumeRepository = new CrmResumeRepository();