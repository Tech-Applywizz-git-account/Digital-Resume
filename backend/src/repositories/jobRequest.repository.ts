import { BaseRepository } from './base.repository.js';

export interface JobRequestRecord {
    id: string;
    user_id?: string;
    email?: string;
    candidate_email?: string;
    job_title?: string;
    resume_path?: string;
    resume_url?: string;
    resume_original_name?: string;
    vercel_portfolio_url?: string;
    application_status?: string;
    created_at?: string;
    [key: string]: unknown;
}

export class JobRequestRepository extends BaseRepository<JobRequestRecord> {
    constructor() {
        super('job_requests');
    }

    async findByEmail(email: string): Promise<JobRequestRecord | null> {
        return this.findOne({ email } as Partial<JobRequestRecord>);
    }
}

export const jobRequestRepository = new JobRequestRepository();