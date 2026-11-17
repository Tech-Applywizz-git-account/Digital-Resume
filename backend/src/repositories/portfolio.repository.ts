import { BaseRepository } from './base.repository.js';

export interface PortfolioRecord {
    id?: string;
    user_id?: string;
    email?: string;
    url?: string;
    created_at?: string;
    [key: string]: unknown;
}

/**
 * PortfolioRepository
 *
 * NOTE: The `portfolio_settings` table is NOT present in the confirmed live database schema.
 * This repository is kept as a placeholder in case the table is added in the future.
 * TODO: Verify with team if this table exists or is planned.
 */
export class PortfolioRepository extends BaseRepository<PortfolioRecord> {
    constructor() {
        super('portfolio_settings');
    }

    async findByUserId(userId: string): Promise<PortfolioRecord | null> {
        return this.findOne({ user_id: userId } as Partial<PortfolioRecord>);
    }
}

export const portfolioRepository = new PortfolioRepository();