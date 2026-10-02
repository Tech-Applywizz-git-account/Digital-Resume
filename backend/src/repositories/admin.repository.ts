import { BaseRepository } from './base.repository.js';

export interface AdminRecord {
    email: string;
    added_by?: string;
    created_at?: string;
    [key: string]: unknown;
}

/**
 * AdminRepository
 *
 * NOTE: The `crm_admins` table is NOT present in the confirmed live database schema.
 * This repository is kept as a placeholder in case the table is added in the future.
 * TODO: Verify with team if this table exists or is planned.
 */
export class AdminRepository extends BaseRepository<AdminRecord> {
    constructor() {
        super('crm_admins');
    }

    async findByEmail(email: string): Promise<AdminRecord | null> {
        return this.findOne({ email } as Partial<AdminRecord>);
    }
}

export const adminRepository = new AdminRepository();