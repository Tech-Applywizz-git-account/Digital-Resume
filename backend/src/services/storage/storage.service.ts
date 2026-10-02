/**
 * Storage Service
 *
 * Handles Supabase Storage operations: URL resolution and file upload.
 * Abstracts bucket selection logic so callers don't need to know
 * which bucket a file belongs to.
 */
import { getDatabase } from '../../config/database.js';

const BUCKETS = {
    RESUMES: 'resumes',
    CRM_RESUMES: 'CRM_users_resumes',
    RECORDINGS: 'recordings',
    CRM_RECORDINGS: 'CRM_users_recordings',
    WALLET_CARDS: 'wallet-cards',
} as const;

export class StorageService {
    /**
     * Resolves a public URL for a stored file path.
     * If the path is already a full HTTP URL, returns it as-is.
     */
    resolvePublicUrl(path: string | null | undefined, bucket: string): string | null {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        try {
            const { data } = getDatabase()
                .storage
                .from(bucket)
                .getPublicUrl(path);
            return data?.publicUrl ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Determines the correct storage bucket based on record source.
     */
    getResumeBucket(isCrmRecord: boolean): string {
        return isCrmRecord ? BUCKETS.CRM_RESUMES : BUCKETS.RESUMES;
    }

    getRecordingBucket(isCrmRecord: boolean): string {
        return isCrmRecord ? BUCKETS.CRM_RECORDINGS : BUCKETS.RECORDINGS;
    }

    async uploadFile(bucket: string, path: string, file: Buffer, contentType: string): Promise<string | null> {
        const db = getDatabase();
        const { data, error } = await db
            .storage
            .from(bucket)
            .upload(path, file, {
                contentType,
                upsert: true,
            });
        if (error) {
            console.error(`[StorageService] Upload failed to bucket "${bucket}" path "${path}":`, JSON.stringify(error, null, 2));
            throw error;
        }
        return data?.path ?? null;
    }
}

export const storageService = new StorageService();