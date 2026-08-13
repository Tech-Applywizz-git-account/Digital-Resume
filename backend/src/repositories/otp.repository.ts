import { BaseRepository } from './base.repository.js';

export interface OtpRecord {
    id?: string;
    email: string;
    code_hash: string;
    expires_at: string;
    attempts?: number;
    created_at?: string;
    [key: string]: unknown;
}

export class OtpRepository extends BaseRepository<OtpRecord> {
    constructor() {
        super('otp_codes');
    }

    async findLatestByEmail(email: string): Promise<OtpRecord | null> {
        const results = await this.findMany(
            { email } as Partial<OtpRecord>,
            { orderBy: 'created_at', orderDirection: 'desc', limit: 1 },
        );
        return results.length > 0 ? results[0] : null;
    }

    async deleteExpired(): Promise<void> {
        const { error } = await this.db
            .from(this.tableName)
            .delete()
            .lt('expires_at', new Date().toISOString());
        if (error) throw error;
    }
}

export const otpRepository = new OtpRepository();