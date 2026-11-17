import { describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../src/config/database.js', () => ({ getDatabase: () => ({ from }) }));

import { getBusinessOverview } from '../src/services/admin/businessOverview.service.js';

describe('Business Overview', () => {
    it('counts unique clients, matches recording files by request, and separates live CI from pending updates', async () => {
        const today = new Date().toISOString();
        const tables: Record<string, object[]> = {
            profiles: [
                { id: 'staff', email: 'staff@example.com', tier: 'digital_resume' },
                { id: 'new', tier: 'digital_resume' },
                { id: 'started', tier: 'digital_resume' },
                { id: 'done', tier: 'digital_resume', credits_remaining: 99 },
                { id: 'ci', tier: 'career_identity' },
            ],
            crm_admins: [{ email: 'staff@example.com' }],
            digital_resume_by_crm: [{ user_id: 'done', email: 'crm@example.com', credits_remaining: 2 }],
            job_requests: [
                { id: 'placeholder', user_id: 'new' },
                { id: 'pdf-only', user_id: 'started', status: 'recorded', resume_path: 'resume.pdf' },
                { id: 'video-only', user_id: 'started', status: 'recorded' },
            ],
            crm_job_requests: [
                { id: 'old-crm', email: 'crm@example.com', application_status: 'recorded', resume_url: 'resume.pdf' },
            ],
            recordings: [{ job_request_id: 'video-only', storage_path: 'intro.webm' }],
            crm_recordings: [{ job_request_id: 'old-crm', video_url: 'intro.webm' }],
            career_identity_projects: [{
                id: 'project', user_id: 'ci', pending_submission_id: 'draft', published_submission_id: 'live',
                clarity_settings: { status: 'active', projectId: 'tracking', clientConsent: { accepted: true } },
            }],
            career_identity_submissions: [{ project_id: 'project', submitted_at: today, published_at: today }],
        };
        from.mockImplementation((table: string) => ({
            select: () => ({ order: () => ({ range: async () => ({ data: tables[table] }) }) }),
        }));

        const result = await getBusinessOverview();
        expect(result.totals).toEqual({ total: 4, digitalResume: 3, careerIdentity: 1, clarityActive: 1 });
        expect(result.digitalResume).toEqual({ noResume: 1, incomplete: 1, completed: 1 });
        expect(result.delivery).toEqual({ notSubmitted: 0, awaitingPublication: 0, published: 1, pendingUpdates: 1 });
        expect(result.activity.firstPublications).toBe(1);
        expect(result.credits).toEqual({ remaining: 2, accountsWithBalance: 1 });
    });
});
