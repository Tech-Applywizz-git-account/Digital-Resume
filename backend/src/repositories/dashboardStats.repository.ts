import { BaseRepository } from './base.repository.js';

export interface DashboardStatsRecord {
    id?: string;
    email: string;
    user_id?: string;
    total_applications?: number;
    total_recordings?: number;
    total_resumes?: number;
    total_views?: number;
    last_application_date?: string;
    last_recording_date?: string;
    last_login_date?: string;
    total_time_spent?: number;
    company_application_email?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export class DashboardStatsRepository extends BaseRepository<DashboardStatsRecord> {
    constructor() {
        super('crm_dashboard_stats');
    }

    async findByEmail(email: string): Promise<DashboardStatsRecord | null> {
        return this.findOne({ email } as Partial<DashboardStatsRecord>);
    }
}

export const dashboardStatsRepository = new DashboardStatsRepository();