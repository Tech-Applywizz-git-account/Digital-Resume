import { BaseRepository } from './base.repository.js';

export interface CrmJobRequestRecord {
    id: string;
    email: string;
    user_id?: string;
    job_title?: string;
    company_name?: string;
    job_description?: string;
    job_url?: string;
    application_status?: string;
    applied_date?: string;
    resume_url?: string;
    cover_letter?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export class CrmJobRequestRepository extends BaseRepository<CrmJobRequestRecord> {
    constructor() {
        super('crm_job_requests');
    }

    async findByEmail(email: string): Promise<CrmJobRequestRecord[]> {
        return this.findMany(
            { email } as Partial<CrmJobRequestRecord>,
            { orderBy: 'created_at', orderDirection: 'desc' },
        );
    }

    async create(data: Partial<CrmJobRequestRecord>): Promise<CrmJobRequestRecord> {
        return super.create(data);
    }
}

export const crmJobRequestRepository = new CrmJobRequestRepository();