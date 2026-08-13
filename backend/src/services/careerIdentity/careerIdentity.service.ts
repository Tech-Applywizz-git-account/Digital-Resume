import { subscriptionService } from '../subscription/subscription.service.js';
import { crmJobRequestRepository } from '../../repositories/crmJobRequest.repository.js';
import { jobRequestRepository } from '../../repositories/jobRequest.repository.js';
import { profileRepository } from '../../repositories/profile.repository.js';
import { NotFoundError, UnauthorizedError } from '../../types/errors.js';
import { getDatabase } from '../../config/database.js';
import { neatpassProvider } from '../wallet/providers/neatpass/neatpass.service.js';
import { storageService } from '../storage/storage.service.js';
import type { WalletCardData } from '../wallet/wallet.types.js';

export interface CareerIdentityDerivedData {
    candidateName: string | null;
    email: string | null;
    jobTitle: string | null;
    resumeUrl: string | null;
    videoUrl: string | null;
    portfolioUrl: string | null;
}

export interface CareerIdentityProfileResponse {
    tier: string | null;
    profile: Record<string, unknown> | null;
    derived: CareerIdentityDerivedData | null;
}

/**
 * Default theme assignment — deterministic round-robin based on the
 * career_identity_theme_assignment_seq sequence (mirrors the old DB trigger).
 */
async function assignTheme(): Promise<string> {
    const db = getDatabase();
    const { data: themes } = await db
        .from('career_identity_themes')
        .select('id')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });

    if (!themes || themes.length === 0) {
        return 'aurora';
    }

    const { data: seqResult } = await db.rpc('nextval', {
        sequence_name: 'public.career_identity_theme_assignment_seq',
    } as any);

    const ticket = seqResult
        ? Number(seqResult)
        : Math.floor(Math.random() * 1000000);

    const targetOffset = (ticket - 1) % themes.length;
    return themes[targetOffset].id;
}

/**
 * Resolves the user_id for a given castId (resume ID) by checking
 * crm_job_requests first, then job_requests.
 */
async function resolveUserIdFromCastId(castId: string): Promise<string | null> {
    const [crmResult, regularResult] = await Promise.all([
        crmJobRequestRepository.findOne({ id: castId } as any),
        jobRequestRepository.findOne({ id: castId } as any),
    ]);

    const record = crmResult || regularResult;
    return record?.user_id ?? null;
}

export class CareerIdentityService {
    /**
     * Resolves the storage bucket and returns a public URL for the given path.
     */
    private resolveStorageUrl(path: string | null | undefined, bucket: string): string | null {
        if (!path) return null;
        if (path.startsWith('http')) return path;
        try {
            const client = getDatabase();
            return client.storage.from(bucket).getPublicUrl(path).data.publicUrl ?? null;
        } catch {
            return null;
        }
    }

    /**
     * Resolves derived data (name, resume, video, portfolio) live from existing tables.
     */
    private async resolveDerivedData(castId: string): Promise<CareerIdentityDerivedData> {
        const [crmResult, regularResult] = await Promise.all([
            crmJobRequestRepository.findOne({ id: castId } as any),
            jobRequestRepository.findOne({ id: castId } as any),
        ]);

        const record = crmResult || regularResult;
        const isCRM = !!crmResult;

        const derived: CareerIdentityDerivedData = {
            candidateName: null,
            email: null,
            jobTitle: null,
            resumeUrl: null,
            videoUrl: null,
            portfolioUrl: null,
        };

        if (!record) return derived;

        const r = record as Record<string, unknown>;
        derived.jobTitle = (r.job_title as string) ?? null;
        derived.email = (r.email as string) ?? (r.candidate_email as string) ?? null;

        const rawResumeUrl = (r.resume_url as string) ?? (r.resume_path as string) ?? null;
        derived.resumeUrl = this.resolveStorageUrl(
            rawResumeUrl,
            isCRM ? 'CRM_users_resumes' : 'resumes'
        );

        const userId: string | null = (r.user_id as string) ?? null;

        if (isCRM) {
            const db = getDatabase();
            const { data: crmVideo } = await db
                .from('crm_recordings')
                .select('video_url')
                .eq('job_request_id', castId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (crmVideo && crmVideo.length > 0 && crmVideo[0].video_url) {
                derived.videoUrl = this.resolveStorageUrl(crmVideo[0].video_url, 'CRM_users_recordings');
            }
        } else {
            const db = getDatabase();
            const { data: regVideo } = await db
                .from('recordings')
                .select('storage_path')
                .eq('job_request_id', castId)
                .order('created_at', { ascending: false })
                .limit(1);

            if (regVideo && regVideo.length > 0 && regVideo[0].storage_path) {
                derived.videoUrl = this.resolveStorageUrl(regVideo[0].storage_path, 'recordings');
            }
        }

        if (userId) {
            const profile = await profileRepository.findById(userId);
            if (profile) {
                derived.candidateName = profile.full_name || profile.first_name || null;
            }
            const db = getDatabase();
            const { data: portfolio } = await db
                .from('portfolio_settings')
                .select('url')
                .eq('user_id', userId)
                .maybeSingle();
            if (portfolio?.url) {
                derived.portfolioUrl = portfolio.url;
            }
        } else if (derived.email) {
            const profile = await profileRepository.findByEmail(derived.email);
            if (profile) {
                derived.candidateName = profile.full_name || profile.first_name || null;
            }
        }

        return derived;
    }

    /**
     * Reads the Career Identity data from profiles.career_identity_data
     * for the user who owns the given castId.
     */
    private async readCareerIdentityData(castId: string): Promise<Record<string, unknown> | null> {
        const userId = await resolveUserIdFromCastId(castId);
        if (!userId) return null;

        const profile = await profileRepository.findById(userId);
        if (!profile) return null;

        const ciData = (profile as any).career_identity_data as Record<string, unknown> | null;
        return ciData ?? null;
    }

    /**
     * Converts a raw career_identity_data JSON object to the DTO shape
     * expected by the frontend.
     */
    private toProfileDTO(
        ciData: Record<string, unknown>,
        castId: string,
        userId: string
    ): Record<string, unknown> {
        return {
            id: userId,
            resumeId: castId,
            userId: userId,
            themeId: ciData.themeId ?? null,
            status: ciData.status ?? 'draft',
            workflowStatus: ciData.workflowStatus ?? 'not_submitted',
            content: ciData.content ?? {},
            createdAt: ciData.createdAt ?? null,
            updatedAt: ciData.updatedAt ?? null,
        };
    }

    // ── Customer Endpoints ──────────────────────────────────────────────

    async getPublicProfile(castId: string): Promise<CareerIdentityProfileResponse> {
        const tier = await subscriptionService.getTier(castId);

        if (tier !== 'career_identity') {
            return { tier, profile: null, derived: null };
        }

        const ciData = await this.readCareerIdentityData(castId);

        if (!ciData) {
            return { tier, profile: null, derived: null };
        }

        if (ciData.status !== 'published') {
            return { tier, profile: null, derived: null };
        }

        const userId = await resolveUserIdFromCastId(castId);
        const derived = await this.resolveDerivedData(castId);

        const profileDTO = userId ? this.toProfileDTO(ciData, castId, userId) : null;

        // Include wallet pass URL in the profile for frontend
        if (profileDTO && ciData.walletPassUrl) {
            (profileDTO as any).walletPassUrl = ciData.walletPassUrl;
        }

        return {
            tier,
            profile: profileDTO,
            derived,
        };
    }

    async getProfile(resumeId: string, userId: string | null): Promise<CareerIdentityProfileResponse> {
        const tier = await subscriptionService.getTier(resumeId);

        if (tier !== 'career_identity') {
            return { tier, profile: null, derived: null };
        }

        if (!userId) {
            return { tier, profile: null, derived: null };
        }

        const profile = await profileRepository.findById(userId);
        if (!profile) {
            return { tier, profile: null, derived: null };
        }

        let ciData = (profile as any).career_identity_data as Record<string, unknown> | null;

        if (!ciData) {
            const now = new Date().toISOString();
            const themeId = await assignTheme();
            ciData = {
                themeId,
                status: 'draft',
                content: {},
                createdAt: now,
                updatedAt: now,
            };

            const db = getDatabase();
            const { error: updateError } = await db
                .from('profiles')
                .update({ career_identity_data: ciData })
                .eq('id', userId);

            if (updateError) throw updateError;
        }

        const derived = await this.resolveDerivedData(resumeId);

        return {
            tier,
            profile: this.toProfileDTO(ciData, resumeId, userId),
            derived,
        };
    }

    private async hasCompletedResumeAndVideo(userId: string): Promise<boolean> {
        const db = getDatabase();

        const [crmJobs, regJobs] = await Promise.all([
            db.from('crm_job_requests').select('id, resume_url').eq('user_id', userId),
            db.from('job_requests').select('id, resume_path').eq('user_id', userId),
        ]);

        const allJobs: any[] = [...(crmJobs.data || []), ...(regJobs.data || [])];

        const hasResume = allJobs.some((j: any) => j.resume_url || j.resume_path);
        if (!hasResume) return false;

        const jobIds: string[] = allJobs.map((j: any) => j.id).filter(Boolean);
        if (jobIds.length === 0) return false;

        const [crmRecordings, regRecordings] = await Promise.all([
            db.from('crm_recordings').select('id').in('job_request_id', jobIds).limit(1),
            db.from('recordings').select('id').in('job_request_id', jobIds).limit(1),
        ]);

        const hasRecording = (crmRecordings.data && crmRecordings.data.length > 0) ||
            (regRecordings.data && regRecordings.data.length > 0);

        return !!hasRecording;
    }

    async updateProfile(
        resumeId: string,
        userId: string | null,
        body: { content?: Record<string, unknown>; status?: string; workflowStatus?: string }
    ): Promise<CareerIdentityProfileResponse> {
        if (!userId) {
            throw new UnauthorizedError('Not authorized to update this profile');
        }

        const profile = await profileRepository.findById(userId);
        if (!profile) {
            throw new NotFoundError('Profile not found');
        }

        const existingCiData = (profile as any).career_identity_data as Record<string, unknown> | null;

        if (!existingCiData) {
            throw new NotFoundError('Career Identity profile not found. Create one first via GET.');
        }

        if (body.workflowStatus === 'submitted') {
            const hasAssets = await this.hasCompletedResumeAndVideo(userId);
            if (!hasAssets) {
                throw new Error(
                    'Cannot submit for Career Identity. You must upload a resume and record a completed intro video first.'
                );
            }
        }

        const existingContent = existingCiData.content as Record<string, unknown> | undefined;
        const mergedContent = body.content
            ? { ...(existingContent ?? {}), ...body.content }
            : (existingContent ?? {});

        const now = new Date().toISOString();
        const updatedCiData: Record<string, unknown> = {
            ...existingCiData,
            content: mergedContent,
            updatedAt: now,
        };

        if (body.status) {
            updatedCiData.status = body.status;
        }

        if (body.workflowStatus) {
            updatedCiData.workflowStatus = body.workflowStatus;
        }

        const db = getDatabase();
        const { error: updateError } = await db
            .from('profiles')
            .update({ career_identity_data: updatedCiData })
            .eq('id', userId);

        if (updateError) throw updateError;

        const tier = await subscriptionService.getTier(resumeId);
        const derived = await this.resolveDerivedData(resumeId);

        return {
            tier,
            profile: this.toProfileDTO(updatedCiData, resumeId, userId),
            derived,
        };
    }

    // ── Admin Endpoints ─────────────────────────────────────────────────

    /**
     * Admin: List all Career Identity requests.
     * Returns users with career_identity_data along with their resume/video assets.
     */
    async listRequests(filter?: { workflowStatus?: string; status?: string }): Promise<any[]> {
        const db = getDatabase();

        // Primary filter: users who have purchased career_identity tier
        const { data: profiles, error } = await db
            .from('profiles')
            .select('id, email, full_name, first_name, tier, career_identity_data, created_at, updated_at')
            .eq('tier', 'career_identity');

        if (error) throw error;
        if (!profiles || profiles.length === 0) return [];

        const results: any[] = [];
        for (const profile of profiles) {
            const ciData = (profile.career_identity_data as Record<string, unknown>) || {};
            const workflowStatus = (ciData.workflowStatus as string) || 'not_submitted';
            const status = (ciData.status as string) || 'draft';

            // Apply optional filters
            if (filter?.workflowStatus && workflowStatus !== filter.workflowStatus) continue;
            if (filter?.status && status !== filter.status) continue;

            const [crmJobs, regJobs] = await Promise.all([
                db.from('crm_job_requests').select('id, resume_url').eq('user_id', profile.id).limit(1),
                db.from('job_requests').select('id, resume_path').eq('user_id', profile.id).limit(1),
            ]);

            const allJobs: any[] = [...(crmJobs.data || []), ...(regJobs.data || [])];
            const firstJob: any = allJobs[0];
            const rawResumeUrl = firstJob?.resume_url || firstJob?.resume_path || null;
            const resumeUrl = rawResumeUrl ? this.resolveStorageUrl(
                rawResumeUrl,
                crmJobs.data?.length ? 'CRM_users_resumes' : 'resumes'
            ) : null;

            let introVideoUrl: string | null = null;
            if (firstJob?.id) {
                const jobId = firstJob.id;
                const [crmVideos, regVideos] = await Promise.all([
                    db.from('crm_recordings').select('video_url').eq('job_request_id', jobId).limit(1),
                    db.from('recordings').select('storage_path').eq('job_request_id', jobId).limit(1),
                ]);
                const crmVideo = (crmVideos.data as any[])?.[0]?.video_url;
                const regVideo = (regVideos.data as any[])?.[0]?.storage_path;
                const rawVideo = crmVideo || regVideo;
                if (rawVideo) {
                    introVideoUrl = this.resolveStorageUrl(
                        rawVideo,
                        crmVideos.data?.length ? 'CRM_users_recordings' : 'recordings'
                    );
                }
            }

            results.push({
                userId: profile.id,
                email: profile.email,
                fullName: profile.full_name || profile.first_name || null,
                workflowStatus,
                status,
                themeId: ciData.themeId || null,
                submissionDate: ciData.createdAt || null,
                createdAt: profile.created_at,
                updatedAt: ciData.updatedAt || profile.updated_at,
                assets: {
                    resumeUrl,
                    introVideoUrl,
                    resumeId: firstJob?.id || null,
                },
            });
        }

        // Sort by workflow priority: submitted → in_progress → ready_for_review → changes_requested → published → not_submitted
        const priorityOrder: Record<string, number> = {
            'submitted': 0,
            'in_progress': 1,
            'ready_for_review': 2,
            'changes_requested': 3,
            'published': 4,
            'not_submitted': 5,
        };

        results.sort((a, b) => {
            const aPriority = priorityOrder[a.workflowStatus] ?? 99;
            const bPriority = priorityOrder[b.workflowStatus] ?? 99;
            if (aPriority !== bPriority) return aPriority - bPriority;
            // Within same status, newest first
            const aDate = a.submissionDate || a.createdAt || '';
            const bDate = b.submissionDate || b.createdAt || '';
            return bDate.localeCompare(aDate);
        });

        return results;
    }

    /**
     * Admin: Get a single Career Identity request by userId.
     */
    async getRequest(userId: string): Promise<any> {
        const db = getDatabase();
        const { data: profile, error } = await db
            .from('profiles')
            .select('id, email, full_name, first_name, tier, career_identity_data, created_at, updated_at')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;
        if (!profile) throw new NotFoundError('User', userId);

        const ciData = (profile.career_identity_data as Record<string, unknown>) || {};
        console.log(`[DIAG-GET] getRequest(${userId}): raw ciData.walletCardUrl=${ciData.walletCardUrl || 'null'}, walletCardStatus=${ciData.walletCardStatus || 'null'}`);

        const [crmJobs, regJobs] = await Promise.all([
            db.from('crm_job_requests').select('id, resume_url, job_title, job_description, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
            db.from('job_requests').select('id, resume_path, job_title, job_description, created_at').eq('user_id', userId).order('created_at', { ascending: false }),
        ]);

        const allJobs: any[] = [...(crmJobs.data || []), ...(regJobs.data || [])];
        const isCRM = (crmJobs.data?.length || 0) > 0;
        const firstJob: any = allJobs[0] || null;
        const rawResumeUrl = firstJob?.resume_url || firstJob?.resume_path || null;
        const resumeUrl = rawResumeUrl ? this.resolveStorageUrl(rawResumeUrl, isCRM ? 'CRM_users_resumes' : 'resumes') : null;

        let introVideoUrl: string | null = null;
        let recordingCreatedAt: string | null = null;
        if (firstJob?.id) {
            const [crmVideos, regVideos] = await Promise.all([
                db.from('crm_recordings').select('video_url, created_at').eq('job_request_id', firstJob.id).order('created_at', { ascending: false }).limit(1),
                db.from('recordings').select('storage_path, created_at').eq('job_request_id', firstJob.id).order('created_at', { ascending: false }).limit(1),
            ]);
            const crmVideoData = (crmVideos.data as any[])?.[0];
            const regVideoData = (regVideos.data as any[])?.[0];
            const rawVideo = crmVideoData?.video_url || regVideoData?.storage_path || null;
            if (rawVideo) {
                introVideoUrl = this.resolveStorageUrl(rawVideo, crmVideoData ? 'CRM_users_recordings' : 'recordings');
                recordingCreatedAt = crmVideoData?.created_at || regVideoData?.created_at || null;
            }
        }

        return {
            userId: profile.id,
            email: profile.email,
            fullName: profile.full_name || profile.first_name || null,
            tier: profile.tier || 'digital_resume',
            workflowStatus: ciData.workflowStatus || 'not_submitted',
            status: ciData.status || 'draft',
            themeId: ciData.themeId || null,
            content: ciData.content || {},
            submissionDate: ciData.createdAt || null,
            createdAt: profile.created_at,
            updatedAt: ciData.updatedAt || profile.updated_at,
            walletCardUrl: ciData.walletCardUrl || null,
            walletCardUpdatedAt: ciData.walletCardUpdatedAt || null,
            walletCardStatus: ciData.walletCardStatus || (ciData.walletCardUrl ? 'generated' : 'idle'),
            walletCardErrorMessage: ciData.walletCardErrorMessage || null,
            walletPassUrl: ciData.walletPassUrl || null,
            assets: {
                resumeUrl,
                introVideoUrl,
                recordingCreatedAt,
                resumeId: firstJob?.id || null,
                jobTitle: firstJob?.job_title || null,
                jobDescription: firstJob?.job_description || null,
            },
        };
    }

    /**
     * Fields on the Wallet Card that should trigger regeneration when changed.
     */
    private readonly WALLET_CARD_FIELDS = new Set([
        'hero.fullName',
        'hero.profileImageUrl',
        'hero.headline',
        'contact.email',
        'contact.phone',
        'contact.location',
    ]);

    /**
     * Checks if the incoming content has changes to any Wallet Card fields
     * compared to the existing content.
     */
    private hasWalletCardContentChanged(
        existingContent: Record<string, unknown>,
        newContent: Record<string, unknown>
    ): boolean {
        for (const field of this.WALLET_CARD_FIELDS) {
            const parts = field.split('.');
            if (parts.length === 2) {
                const section = parts[0];
                const key = parts[1];
                const existingSection = existingContent[section] as Record<string, unknown> | undefined;
                const newSection = newContent[section] as Record<string, unknown> | undefined;
                const existingValue = existingSection?.[key];
                const newValue = newSection?.[key];
                if (existingValue !== newValue) return true;
            }
        }
        return false;
    }

    /**
     * Admin: Update a Career Identity request.
     * After saving, conditionally regenerates the Wallet Card PNG only when
     * wallet-related content fields change. Never blocks the save.
     */
    async adminUpdateRequest(userId: string, body: {
        workflowStatus?: string;
        status?: string;
        themeId?: string;
        content?: Record<string, unknown>;
        walletPassUrl?: string;
    }): Promise<any> {
        const db = getDatabase();
        const { data: profile, error: fetchError } = await db
            .from('profiles')
            .select('career_identity_data')
            .eq('id', userId)
            .maybeSingle();

        if (fetchError) throw fetchError;
        if (!profile) throw new NotFoundError('User', userId);

        const existingCiData = (profile.career_identity_data as Record<string, unknown>) || {};
        const now = new Date().toISOString();

        const updatedCiData: Record<string, unknown> = {
            ...existingCiData,
            updatedAt: now,
        };

        if (body.workflowStatus !== undefined) {
            updatedCiData.workflowStatus = body.workflowStatus;
        }
        if (body.status !== undefined) {
            updatedCiData.status = body.status;
        }
        if (body.themeId !== undefined) {
            updatedCiData.themeId = body.themeId;
        }
        if (body.content !== undefined) {
            const existingContent = (existingCiData.content as Record<string, unknown>) || {};
            updatedCiData.content = { ...existingContent, ...body.content };
        }
        if (body.walletPassUrl !== undefined) {
            updatedCiData.walletPassUrl = body.walletPassUrl;
        }

        const { error: updateError } = await db
            .from('profiles')
            .update({ career_identity_data: updatedCiData })
            .eq('id', userId);

        if (updateError) throw updateError;

        console.log(`[DIAG] adminUpdateRequest: body.content present=${body.content !== undefined}, existingCiData.walletCardUrl=${existingCiData.walletCardUrl || 'null'}`);

        // Conditionally regenerate Wallet Card PNG only if wallet-related fields changed
        // OR if the wallet card URL is missing (e.g. previous failed generation with stale status).
        // Never blocks the save — failures are logged and non-fatal
        if (body.content !== undefined) {
            const existingContent = (existingCiData.content as Record<string, unknown>) || {};
            const walletCardUrlExists = !!existingCiData.walletCardUrl;
            const needsRegen = !walletCardUrlExists || this.hasWalletCardContentChanged(existingContent, body.content);
            console.log(`[DIAG] adminUpdateRequest: walletCardUrlExists=${walletCardUrlExists}, hasFieldsChanged=${this.hasWalletCardContentChanged(existingContent, body.content)}, needsRegen=${needsRegen}`);
            if (needsRegen) {
                console.log(`[CareerIdentity] Wallet card generation triggered for user ${userId}: walletCardUrlExists=${walletCardUrlExists}`);
                try {
                    const walletCardUrl = await this.generateWalletCard(userId);
                    console.log(`[DIAG] generateWalletCard returned: ${walletCardUrl || 'null'}`);
                    const now = new Date().toISOString();
                    const finalStatus: Record<string, unknown> = {
                        walletCardStatus: walletCardUrl ? 'generated' : 'failed',
                        walletCardErrorMessage: walletCardUrl ? null : 'Wallet card generation returned no URL',
                        walletCardUrl: walletCardUrl || null,
                        walletCardUpdatedAt: walletCardUrl ? now : null,
                    };
                    console.log(`[DIAG] Saving finalStatus: ${JSON.stringify(finalStatus)}`);
                    await db
                        .from('profiles')
                        .update({ career_identity_data: { ...updatedCiData, ...finalStatus } })
                        .eq('id', userId);
                } catch (err) {
                    console.error(`[CareerIdentity] Failed to auto-generate wallet card for user ${userId}:`, err);
                    try {
                        const errorMessage = err instanceof Error ? err.message : 'Unknown error generating wallet card';
                        await db
                            .from('profiles')
                            .update({
                                career_identity_data: {
                                    ...updatedCiData,
                                    walletCardStatus: 'failed',
                                    walletCardErrorMessage: errorMessage,
                                }
                            })
                            .eq('id', userId);
                    } catch { /* non-fatal */ }
                }
            }
        }

        return updatedCiData;
    }

    /**
     * Generates (or regenerates) the Wallet Card PNG for a user's Career Identity.
     * Uploads the PNG to Supabase Storage and updates walletCardUrl in career_identity_data.
     */
    async generateWalletCard(userId: string): Promise<string | null> {
        const db = getDatabase();
        console.log(`[DIAG] generateWalletCard: START for userId=${userId}`);
        const { data: profile, error: fetchError } = await db
            .from('profiles')
            .select('id, full_name, first_name, career_identity_data')
            .eq('id', userId)
            .maybeSingle();

        if (fetchError || !profile) {
            console.log(`[DIAG] generateWalletCard: FAILED at profile fetch. fetchError=${fetchError?.message}, profile=${!!profile}`);
            return null;
        }
        console.log(`[DIAG] generateWalletCard: Profile fetched successfully`);

        const ciData = (profile.career_identity_data as Record<string, unknown>) || {};
        const content = (ciData.content as Record<string, unknown>) || {};
        const hero = (content.hero as Record<string, unknown>) || {};
        const contact = (content.contact as Record<string, unknown>) || {};

        // Find the user's castId (resume ID)
        const [crmJobs, regJobs] = await Promise.all([
            db.from('crm_job_requests').select('id, company_name').eq('user_id', userId).limit(1),
            db.from('job_requests').select('id, company_name').eq('user_id', userId).limit(1),
        ]);
        const allJobs: any[] = [...(crmJobs.data || []), ...(regJobs.data || [])];
        const firstJob: any = allJobs[0];
        const castId: string | null = firstJob?.id || null;
        if (!castId) {
            console.log(`[DIAG] generateWalletCard: FAILED - no castId found for userId=${userId}`);
            return null;
        }
        console.log(`[DIAG] generateWalletCard: castId=${castId}`);

        const CARD_BASE_URL: string = process.env.CAREER_IDENTITY_PUBLIC_URL || 'https://applywizz.com';

        const walletData: WalletCardData = {
            fullName: (hero.fullName as string) || profile.full_name || profile.first_name || null,
            jobTitle: (hero.headline as string) || firstJob?.job_title || null,
            headline: (hero.headline as string) || null,
            location: (contact.location as string) || null,
            email: (contact.email as string) || null,
            phone: (contact.phone as string) || null,
            profileImageUrl: (hero.profileImageUrl as string) || null,
            careerIdentityUrl: `${CARD_BASE_URL}/career-identity/${castId}`,
            castId,
            company: firstJob?.company_name || null,
        };
        console.log(`[DIAG] generateWalletCard: walletData prepared, calling neatpass provider`);

        // Generate PNG
        const pngBuffer = await neatpassProvider.generateCard(walletData);
        console.log(`[DIAG] generateWalletCard: PNG generated, buffer length=${pngBuffer.length}`);

        // Upload to storage (path is object key within the bucket, not bucket name)
        const storagePath = `${userId}.png`;
        console.log(`[DIAG] generateWalletCard: uploading to bucket "wallet-cards" path "${storagePath}"`);
        const uploadedPath = await storageService.uploadFile('wallet-cards', storagePath, pngBuffer, 'image/png');
        console.log(`[DIAG] generateWalletCard: upload returned uploadedPath=${uploadedPath || 'null'}`);
        if (!uploadedPath) return null;

        // Get public URL
        const publicUrl = storageService.resolvePublicUrl(uploadedPath, 'wallet-cards');
        console.log(`[DIAG] generateWalletCard: publicUrl=${publicUrl}`);

        // Update career_identity_data with wallet card info
        const now = new Date().toISOString();
        const updatedCiData: Record<string, unknown> = {
            ...ciData,
            walletCardUrl: publicUrl,
            walletCardUpdatedAt: now,
            updatedAt: now,
        };
        console.log(`[DIAG] generateWalletCard: saving to DB: walletCardUrl=${publicUrl}`);

        const { error: updateError } = await db
            .from('profiles')
            .update({ career_identity_data: updatedCiData })
            .eq('id', userId);

        if (updateError) {
            console.error(`[CareerIdentity] Failed to update walletCardUrl for user ${userId}:`, updateError);
            return null;
        }

        // Verify by re-reading
        const { data: verifyProfile } = await db
            .from('profiles')
            .select('career_identity_data')
            .eq('id', userId)
            .maybeSingle();
        const verifyCiData = verifyProfile?.career_identity_data as Record<string, unknown> || {};
        console.log(`[DIAG] generateWalletCard: VERIFY after save - walletCardUrl=${verifyCiData.walletCardUrl || 'null'}, walletCardStatus=${verifyCiData.walletCardStatus || 'null'}`);

        return publicUrl;
    }

}

export const careerIdentityService = new CareerIdentityService();