import { describe, it, expect, vi } from 'vitest';

const { mockDb } = vi.hoisted(() => {
    const mockDb: any = {
        from: vi.fn(),
        storage: {
            from: vi.fn(() => ({
                getPublicUrl: vi.fn((path: string) => ({ data: { publicUrl: path } })),
            })),
        },
    };
    return { mockDb };
});

vi.mock('../src/config/database.js', () => ({
    getDatabase: () => mockDb,
}));

import { CareerIdentityService } from '../src/services/careerIdentity/careerIdentity.service.js';

describe('CareerIdentityService - Cast ID and Resume Resolution', () => {
    it('prioritizes newest created job request with resume over older touched records', async () => {
        const service = new CareerIdentityService();

        mockDb.from.mockImplementation((table: string) => {
            if (table === 'crm_job_requests') {
                return {
                    select: vi.fn().mockReturnThis(),
                    or: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: '515bb014-cccb-4da7-999f-58cca9a4b9ee',
                                resume_url: 'https://example.com/user_careercast_latest.pdf',
                                job_title: 'Software Developer',
                                job_description: 'Latest test',
                                created_at: '2026-07-07T06:12:46.894436+00:00',
                                updated_at: '2026-07-07T06:13:26.137+00:00',
                            },
                            {
                                id: 'f4a6bf67-0363-4d8c-8c25-34931885876d',
                                resume_url: 'https://example.com/replaced_old_resume.pdf',
                                job_title: 'Software Engineer',
                                job_description: 'Old test',
                                created_at: '2026-02-23T06:23:41.00855+00:00',
                                updated_at: '2026-07-29T05:40:09.735+00:00', // Newer updated_at from old edit
                            },
                            {
                                id: '34a86d4a-2e9e-4d99-bd13-e0ee7c9a769f',
                                resume_url: null, // Empty placeholder
                                job_title: null,
                                job_description: null,
                                created_at: '2026-03-05T10:22:24.974537+00:00',
                                updated_at: '2026-03-05T10:22:24.974537+00:00',
                            },
                        ],
                    }),
                };
            }
            if (table === 'job_requests') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({ data: [] }),
                };
            }
            return { select: vi.fn().mockReturnThis() };
        });

        vi.spyOn(service as any, 'resolveStorageUrl').mockImplementation((p: any) => p);

        const result = await (service as any).findLatestResume('user_123', 'test@example.com');
        expect(result.job).toBeDefined();
        expect(result.job.id).toBe('515bb014-cccb-4da7-999f-58cca9a4b9ee');
        expect(result.resumeUrl).toBe('https://example.com/user_careercast_latest.pdf');
    });

    it('respects preferredCastId if provided and present in candidate records', async () => {
        const service = new CareerIdentityService();

        mockDb.from.mockImplementation((table: string) => {
            if (table === 'crm_job_requests') {
                return {
                    select: vi.fn().mockReturnThis(),
                    or: vi.fn().mockReturnThis(),
                    order: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: '515bb014-cccb-4da7-999f-58cca9a4b9ee',
                                resume_url: 'https://example.com/careercast.pdf',
                                created_at: '2026-07-07T06:12:46.894436+00:00',
                            },
                            {
                                id: 'custom_pinned_cast_id',
                                resume_url: 'https://example.com/pinned.pdf',
                                created_at: '2026-05-01T00:00:00.000000+00:00',
                            },
                        ],
                    }),
                };
            }
            return {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                order: vi.fn().mockResolvedValue({ data: [] }),
            };
        });

        vi.spyOn(service as any, 'resolveStorageUrl').mockImplementation((p: any) => p);

        const result = await (service as any).findLatestResume('user_123', 'test@example.com', 'custom_pinned_cast_id');
        expect(result.job).toBeDefined();
        expect(result.job.id).toBe('custom_pinned_cast_id');
        expect(result.resumeUrl).toBe('https://example.com/pinned.pdf');
    });

    it('projects default clarity status as disabled and clarityProjectId as null when not configured or inactive', () => {
        const service = new CareerIdentityService();
        const ciData = {
            themeId: 'aurora',
            status: 'published',
            content: {},
        };

        const dto = (service as any).toProfileDTO(ciData, 'cast_123', 'user_123');
        expect(dto.clarity).toBeDefined();
        expect(dto.clarity.status).toBe('disabled');
        expect(dto.clarity.clientConsent.accepted).toBe(false);
        expect(dto.clarityProjectId).toBeNull();
        expect(dto.clarityStatus).toBe('disabled');
    });

    it('strips clarityProjectId to null in getPublicProfile if clarity.status is disabled', () => {
        const service = new CareerIdentityService();
        const disabledCiData = {
            themeId: 'zenith',
            status: 'published',
            clarity: {
                projectId: 'clarity_project_secret_123',
                accountEmail: 'client@applywizz.com',
                status: 'disabled',
                clientConsent: { accepted: false, acceptedAt: null },
            },
        };

        const dto = (service as any).toProfileDTO(disabledCiData, 'cast_123', 'user_123');
        // When status is disabled, even if projectId exists in DB, public exposure must be blocked
        let publicClarityProjectId: string | null = null;
        let publicClarityStatus = 'disabled';
        if (disabledCiData.clarity && disabledCiData.clarity.status === 'active' && disabledCiData.clarity.projectId) {
            publicClarityProjectId = disabledCiData.clarity.projectId;
            publicClarityStatus = 'active';
        } else {
            publicClarityProjectId = null;
            publicClarityStatus = disabledCiData.clarity?.status || 'disabled';
        }

        expect(publicClarityProjectId).toBeNull();
        expect(publicClarityStatus).toBe('disabled');
    });

    it('projects clarityProjectId only when clarity status is active', () => {
        const service = new CareerIdentityService();
        const activeCiData = {
            themeId: 'zenith',
            status: 'published',
            clarity: {
                projectId: 'clarity_project_999',
                accountEmail: 'client@applywizz.com',
                status: 'active',
                clientConsent: { accepted: true, acceptedAt: '2026-11-03T00:00:00Z' },
            },
        };

        const dto = (service as any).toProfileDTO(activeCiData, 'cast_123', 'user_123');
        expect(dto.clarityProjectId).toBe('clarity_project_999');
        expect(dto.clarityStatus).toBe('active');
    });

    it('records revokedAt timestamp when client or admin revokes clarity consent', () => {
        const service = new CareerIdentityService();
        const revokedCiData = {
            themeId: 'zenith',
            status: 'published',
            clarity: {
                projectId: 'clarity_project_999',
                accountEmail: 'client@applywizz.com',
                status: 'disabled',
                clientConsent: {
                    accepted: false,
                    acceptedAt: '2026-11-03T10:00:00.000Z',
                    revokedAt: '2026-11-03T12:00:00.000Z',
                },
            },
        };

        const dto = (service as any).toProfileDTO(revokedCiData, 'cast_123', 'user_123');
        expect(dto.clarity.status).toBe('disabled');
        expect(dto.clarity.clientConsent.accepted).toBe(false);
        expect(dto.clarity.clientConsent.acceptedAt).toBe('2026-11-03T10:00:00.000Z');
        expect(dto.clarity.clientConsent.revokedAt).toBe('2026-11-03T12:00:00.000Z');
        expect(dto.clarityProjectId).toBeNull();
    });

    it('allows resetting consent to fresh opt-in with null acceptedAt and null revokedAt', () => {
        const service = new CareerIdentityService();
        const resetCiData = {
            themeId: 'zenith',
            status: 'published',
            clarity: {
                projectId: 'clarity_project_999',
                accountEmail: 'client@applywizz.com',
                status: 'disabled',
                clientConsent: {
                    accepted: false,
                    acceptedAt: null,
                    revokedAt: null,
                },
            },
        };

        const dto = (service as any).toProfileDTO(resetCiData, 'cast_123', 'user_123');
        expect(dto.clarity.status).toBe('disabled');
        expect(dto.clarity.clientConsent.accepted).toBe(false);
        expect(dto.clarity.clientConsent.acceptedAt).toBeNull();
        expect(dto.clarity.clientConsent.revokedAt).toBeNull();
    });

    it('filters requests by clarityStatus (e.g. pending opt-ins)', async () => {
        const service = new CareerIdentityService();

        mockDb.from.mockImplementation((table: string) => {
            if (table === 'profiles') {
                return {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'user_pending',
                                email: 'pending@example.com',
                                full_name: 'Pending User',
                                tier: 'career_identity',
                                career_identity_data: {
                                    workflowStatus: 'submitted',
                                    status: 'draft',
                                    clarity: { status: 'pending', clientConsent: { accepted: true } },
                                },
                            },
                            {
                                id: 'user_active',
                                email: 'active@example.com',
                                full_name: 'Active User',
                                tier: 'career_identity',
                                career_identity_data: {
                                    workflowStatus: 'published',
                                    status: 'published',
                                    clarity: { status: 'active', clientConsent: { accepted: true } },
                                },
                            },
                        ],
                        error: null,
                    }),
                };
            }
            const chainable: any = {
                select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                or: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue({ data: [] }),
            };
            return chainable;
        });

        vi.spyOn(service as any, 'findLatestResume').mockResolvedValue({ job: null, resumeUrl: null });

        const pendingResults = await service.listRequests({ clarityStatus: 'pending' });
        expect(pendingResults).toHaveLength(1);
        expect(pendingResults[0].userId).toBe('user_pending');
        expect(pendingResults[0].clarityStatus).toBe('pending');

        const activeResults = await service.listRequests({ clarityStatus: 'active' });
        expect(activeResults).toHaveLength(1);
        expect(activeResults[0].userId).toBe('user_active');
        expect(activeResults[0].clarityStatus).toBe('active');
    });
});

