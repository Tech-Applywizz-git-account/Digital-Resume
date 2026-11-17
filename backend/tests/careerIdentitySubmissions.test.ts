import { describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../src/config/database.js', () => ({
    getDatabase: () => ({ from }),
}));

import { assetUrl, eligibleResumes } from '../src/services/careerIdentity/submissions.service.js';

describe('Career Identity eligible resumes', () => {
    it('sorts recorded entries across sources and rejects a video from a different cast', async () => {
        const calls: Record<string, any> = {};
        const data: Record<string, object[]> = {
            crm_job_requests: [
                { id: 'crm-draft', application_status: 'draft', created_at: '2026-11-04T00:00:00Z', resume_url: 'https://example.com/draft.pdf' },
                { id: 'crm-new-no-video', application_status: 'recorded', created_at: '2026-11-03T00:00:00Z', resume_url: 'https://example.com/new.pdf' },
                { id: 'crm-old', application_status: 'recorded', created_at: '2026-10-01T00:00:00Z', resume_url: 'https://example.com/old.pdf' },
            ],
            job_requests: [
                { id: 'regular', status: 'recorded', created_at: '2026-11-02T00:00:00Z', resume_path: 'https://example.com/regular.pdf' },
            ],
            crm_recordings: [
                { id: 'crm-video', job_request_id: 'crm-old', video_url: 'https://example.com/old.webm' },
                { id: 'unrelated-video', job_request_id: 'different-cast', video_url: 'https://example.com/other.webm' },
                { id: 'draft-video', job_request_id: 'crm-draft', video_url: 'https://example.com/draft.webm' },
            ],
            recordings: [
                { id: 'regular-video', job_request_id: 'regular', storage_path: 'https://example.com/regular.webm' },
            ],
        };
        from.mockImplementation(table => {
            const query = {
                select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
                not: vi.fn().mockReturnThis(), in: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                then: (resolve: (result: object) => void) => resolve({ data: data[table] }),
            };
            calls[table] = query;
            return query;
        });

        const result = await eligibleResumes('owner');
        expect(result.map(({ castId, recordingId }) => [castId, recordingId])).toEqual([
            ['regular', 'regular-video'],
            ['crm-old', 'crm-video'],
        ]);
        expect(calls.crm_job_requests.eq).toHaveBeenCalledWith('user_id', 'owner');
        expect(calls.job_requests.eq).toHaveBeenCalledWith('user_id', 'owner');
        expect(calls.crm_recordings.in).toHaveBeenCalledWith('job_request_id', ['crm-new-no-video', 'crm-old']);
        expect(result.map(({ recordingNumber }) => recordingNumber)).toEqual([1, 1]);
    });
});

describe('Career Identity saved asset URLs', () => {
    it('uses an existing CRM file URL directly and rejects untrusted hosts', async () => {
        const resumeUrl = 'https://applywizz-prod.s3.us-east-2.amazonaws.com/CRM/resume.pdf';
        await expect(assetUrl(resumeUrl)).resolves.toBe(resumeUrl);
        await expect(assetUrl('http://localhost:4000/private')).rejects.toMatchObject({ code: 'CI_ASSET_HOST' });
    });
});
