import { BaseRepository } from './base.repository.js';

export interface RecordingRecord {
    id?: string;
    job_request_id?: string;
    email?: string;
    user_id?: string;
    storage_path?: string;
    duration_seconds?: number;
    size_bytes?: number;
    video_url?: string;
    thumbnail_url?: string;
    duration?: number;
    file_size?: number;
    recording_date?: string;
    transcription?: string;
    status?: string;
    created_at?: string;
    updated_at?: string;
    [key: string]: unknown;
}

export class RecordingRepository extends BaseRepository<RecordingRecord> {
    constructor() {
        super('recordings');
    }

    async findByJobRequestId(jobRequestId: string): Promise<RecordingRecord[]> {
        return this.findMany(
            { job_request_id: jobRequestId } as Partial<RecordingRecord>,
            { orderBy: 'created_at', orderDirection: 'desc' },
        );
    }
}

export class CrmRecordingRepository extends BaseRepository<RecordingRecord> {
    constructor() {
        super('crm_recordings');
    }

    async findByEmail(email: string): Promise<RecordingRecord[]> {
        return this.findMany(
            { email } as Partial<RecordingRecord>,
            { orderBy: 'created_at', orderDirection: 'desc' },
        );
    }

    async findByJobRequestId(jobRequestId: string): Promise<RecordingRecord[]> {
        return this.findMany(
            { job_request_id: jobRequestId } as Partial<RecordingRecord>,
            { orderBy: 'created_at', orderDirection: 'desc' },
        );
    }
}

export const recordingRepository = new RecordingRepository();
export const crmRecordingRepository = new CrmRecordingRepository();