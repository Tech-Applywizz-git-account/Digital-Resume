import { BaseRepository } from './base.repository.js';

export interface ThemeRecord {
    id: string;
    name: string;
    description?: string;
    is_active?: boolean;
    sort_order?: number;
    created_at?: string;
    [key: string]: unknown;
}

/**
 * ThemeRepository
 *
 * Repository for career_identity_themes table.
 * This table is confirmed to exist from the migration files.
 */
export class ThemeRepository extends BaseRepository<ThemeRecord> {
    constructor() {
        super('career_identity_themes');
    }

    async findActive(): Promise<ThemeRecord[]> {
        return this.findMany(
            { is_active: true } as Partial<ThemeRecord>,
            { orderBy: 'sort_order', orderDirection: 'asc' },
        );
    }
}

export const themeRepository = new ThemeRepository();