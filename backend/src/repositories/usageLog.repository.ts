import { BaseRepository } from './base.repository.js';

export interface UsageLogRecord {
    id?: string;
    user_id?: string;
    feature_name?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
    created_at?: string;
    [key: string]: unknown;
}

/**
 * UsageLogRepository
 *
 * NOTE: The `openai_usage_logs` table is NOT present in the confirmed live database schema.
 * This repository is kept as a placeholder in case the table is added in the future.
 * TODO: Verify with team if this table exists or is planned.
 */
export class UsageLogRepository extends BaseRepository<UsageLogRecord> {
    constructor() {
        super('openai_usage_logs');
    }

    async findByUserId(userId: string): Promise<UsageLogRecord[]> {
        return this.findMany(
            { user_id: userId } as Partial<UsageLogRecord>,
            { orderBy: 'created_at', orderDirection: 'desc' },
        );
    }
}

export const usageLogRepository = new UsageLogRepository();