import { isDeepStrictEqual } from 'node:util';
import { assetUrl, eligibleResumes, getProject, getSubmission, hasWithdrawnSubmission } from './submissions.service.js';
import { subscriptionService } from '../subscription/subscription.service.js';
import { crmJobRequestRepository } from '../../repositories/crmJobRequest.repository.js';
import { jobRequestRepository } from '../../repositories/jobRequest.repository.js';
import { profileRepository } from '../../repositories/profile.repository.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../types/errors.js';
import { getDatabase } from '../../config/database.js';
import { neatpassProvider } from '../wallet/providers/neatpass/neatpass.service.js';
import { storageService } from '../storage/storage.service.js';
import type { WalletCardData } from '../wallet/wallet.types.js';
import {
    callApplyWizardParser,
    adaptParserResponse,
    type AutoFillContext,
} from './resumeParser.service.js';
import { crmUserRepository } from '../../repositories/crmUser.repository.js';
import {
    fetchClientGender,
    assignRandomAvatar,
    assignRandomTheme,
} from './clientOnboarding.service.js';

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

export interface CareerIdentityClarityConfig {
    projectId: string | null;
    accountEmail: string | null;
    accountType: 'company_zoho' | 'client_personal' | null;
    role: 'member';
    status: 'disabled' | 'pending' | 'active';
    clientConsent: {
        accepted: boolean;
        acceptedAt: string | null;
        revokedAt?: string | null;
    };
    notes?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * Default theme assignment — randomly selects among the 3 active themes: aurora, zenith, atlas.
 */
async function assignTheme(): Promise<string> {
    return assignRandomTheme();
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
        const clarity = (ciData.clarity as CareerIdentityClarityConfig | undefined) ?? {
            projectId: null,
            accountEmail: null,
            accountType: null,
            role: 'member',
            status: 'disabled',
            clientConsent: { accepted: false, acceptedAt: null, revokedAt: null },
            notes: null,
        };

        return {
            id: userId,
            resumeId: castId,
            userId: userId,
            themeId: ciData.themeId ?? null,
            status: ciData.status ?? 'draft',
            workflowStatus: ciData.workflowStatus ?? 'not_submitted',
            content: ciData.content ?? {},
            ...(ciData.submissionId ? { submissionId: ciData.submissionId, walletPassUrl: ciData.walletPassUrl ?? null } : {}),
            createdAt: ciData.createdAt ?? null,
            updatedAt: ciData.updatedAt ?? null,
            clarity,
            clarityProjectId: clarity.status === 'active' ? clarity.projectId : null,
            clarityStatus: clarity.status ?? 'disabled',
            clarityClientConsent: clarity.clientConsent ?? { accepted: false, acceptedAt: null, revokedAt: null },
            clarityAccountEmail: clarity.accountEmail ?? null,
        };
    }

    // ── Customer Endpoints ──────────────────────────────────────────────

    async getDashboard(userId: string) {
        const { tier } = await subscriptionService.getEffectiveUserTier(userId);
        if (tier !== 'career_identity') throw new ForbiddenError('Career Identity access required');

        const [project, eligible, profile] = await Promise.all([
            getProject(userId), eligibleResumes(userId), profileRepository.findById(userId),
        ]);
        const legacy = profile?.career_identity_data as any;
        const [pending, published] = await Promise.all([
            getSubmission(project?.pending_submission_id ?? null),
            getSubmission(project?.published_submission_id ?? null),
        ]);
        const publishedHero = published
            ? published.content?.hero
            : legacy?.status === 'published' ? legacy.content?.hero : null;
        const accountName = profile?.full_name?.trim()
            || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
        const publishedId = project?.published_submission_id
            ? project.id : legacy?.status === 'published' ? legacy.castId || legacy.resumeId || eligible[0]?.castId : null;
        const recordingFor = (submission: typeof pending) => {
            const entry = submission && eligible.find(item =>
                item.castId === submission.source_cast_id && item.source === submission.source_type);
            return entry ? { number: entry.recordingNumber, createdAt: entry.createdAt } : null;
        };
        const legacyWorkflow = legacy?.workflowStatus ?? 'not_submitted';
        const withdrawn = project && !pending && !publishedId && legacyWorkflow !== 'not_submitted'
            && await hasWithdrawnSubmission(project.id);
        return {
            eligible,
            publishedId,
            publishedRecording: recordingFor(published),
            appearance: published ? {
                submissionId: published.id, themeId: published.theme_id,
                avatar: publishedHero?.profileImageUrl ?? null,
            } : null,
            summary: {
                name: publishedHero?.fullName?.trim() || accountName || null,
                email: profile?.email ?? null,
            },
            workflowStatus: pending?.workflow_status ?? (publishedId ? 'published' : withdrawn ? 'not_submitted' : legacyWorkflow),
            pending: pending ? {
                id: pending.id, castId: pending.source_cast_id, submittedAt: pending.submitted_at,
                recording: recordingFor(pending),
                resumeUrl: await assetUrl(pending.resume_asset_ref), videoUrl: await assetUrl(pending.video_asset_ref),
            } : null,
            clarity: project?.clarity_settings ?? legacy?.clarity ?? null,
        };
    }

    async updateConsent(userId: string, accepted: boolean) {
        const { tier } = await subscriptionService.getEffectiveUserTier(userId);
        if (tier !== 'career_identity') throw new ForbiddenError('Career Identity access required');
        const { error } = await getDatabase().rpc('ci_update_consent', { p_user: userId, p_accepted: accepted });
        if (error) throw error;
    }

    private async versionAssets(submission: any) {
        const { data: job, error } = await getDatabase().from(submission.source_type)
            .select('job_title, job_description').eq('id', submission.source_cast_id).maybeSingle();
        if (error) throw error;
        const [resumeUrl, introVideoUrl] = await Promise.all([
            assetUrl(submission.resume_asset_ref), assetUrl(submission.video_asset_ref),
        ]);
        return {
            resumeId: submission.source_cast_id, resumeUrl, introVideoUrl,
            jobTitle: job?.job_title ?? null, jobDescription: job?.job_description ?? null,
            recordingCreatedAt: null,
        };
    }

    async getPublicAsset(castId: string, kind: string) {
        if (kind !== 'resume' && kind !== 'video') return null;
        const project = await getProject(castId, true);
        if (!project?.published_submission_id) return null;
        const { tier } = await subscriptionService.getEffectiveUserTier(project.user_id);
        if (tier !== 'career_identity') return null;
        const version = await getSubmission(project.published_submission_id);
        return assetUrl(kind === 'resume' ? version.resume_asset_ref : version.video_asset_ref);
    }

    async getPublicProfile(castId: string): Promise<CareerIdentityProfileResponse> {
        const directProject = await getProject(castId, true);
        const owner = directProject?.user_id ?? await resolveUserIdFromCastId(castId);
        const project = directProject ?? (owner ? await getProject(owner) : null);
        const tier = owner
            ? (await subscriptionService.getEffectiveUserTier(owner)).tier
            : await subscriptionService.getTier(castId);
        if (project?.published_submission_id && tier === 'career_identity') {
            const submission = await getSubmission(project.published_submission_id);
            const [assets, profile, portfolio] = await Promise.all([
                this.versionAssets(submission), profileRepository.findById(project.user_id),
                getDatabase().from('portfolio_settings').select('url').eq('user_id', owner).maybeSingle(),
            ]);
            return {
                tier,
                profile: this.toProfileDTO({
                    content: submission.content, themeId: submission.theme_id, status: 'published',
                    workflowStatus: 'published', clarity: project.clarity_settings,
                    submissionId: submission.id, walletPassUrl: submission.content?.walletPassUrl,
                    createdAt: submission.submitted_at, updatedAt: submission.updated_at,
                }, submission.source_cast_id, project.user_id),
                derived: {
                    candidateName: profile?.full_name || profile?.first_name || null, email: profile?.email ?? null,
                    jobTitle: assets.jobTitle, resumeUrl: assets.resumeUrl, videoUrl: assets.introVideoUrl,
                    portfolioUrl: portfolio.data?.url ?? null,
                },
            };
        }
        if (directProject) return { tier, profile: null, derived: null };

        if (tier !== 'career_identity') {
            return { tier, profile: null, derived: null };
        }

        const legacy = await this.readCareerIdentityData(castId);
        const ciData: Record<string, unknown> | null = legacy && project ? { ...legacy, clarity: project.clarity_settings } : legacy;

        if (!ciData) {
            return { tier, profile: null, derived: null };
        }

        if (ciData.status !== 'published') {
            return { tier, profile: null, derived: null };
        }

        const userId = await resolveUserIdFromCastId(castId);
        const derived = await this.resolveDerivedData(castId);

        const profileDTO = userId ? this.toProfileDTO(ciData, castId, userId) : null;

        if (profileDTO) {
            if (ciData.walletPassUrl) (profileDTO as any).walletPassUrl = ciData.walletPassUrl;
            if (ciData.walletCardUrl) (profileDTO as any).walletCardUrl = ciData.walletCardUrl;
            if (ciData.walletCardUpdatedAt) (profileDTO as any).walletCardUpdatedAt = ciData.walletCardUpdatedAt;

            const clarity = ciData.clarity as CareerIdentityClarityConfig | undefined;
            if (clarity && clarity.status === 'active' && clarity.projectId) {
                (profileDTO as any).clarityProjectId = clarity.projectId;
                (profileDTO as any).clarityStatus = 'active';
            } else {
                (profileDTO as any).clarityProjectId = null;
                (profileDTO as any).clarityStatus = clarity?.status || 'disabled';
            }
        }

        return {
            tier,
            profile: profileDTO,
            derived,
        };
    }

    /**
     * Ensures Career Identity data has a random theme and gender-matched avatar assigned.
     * - Random Theme: picked from 'aurora' | 'zenith' | 'atlas' if not set.
     * - Gender Avatar: queries CRM onboarding API if avatar is not set.
     * - If API is down / gender unknown: avatar is left null.
     * - If theme/avatar already exist: preserved (never overwritten).
     */
    async ensureInitializedCareerIdentity(
        userId: string,
        email: string,
        existingCiData: Record<string, any> | null
    ): Promise<Record<string, any>> {
        let ciData: Record<string, any> = existingCiData ? { ...existingCiData } : {
            themeId: assignRandomTheme(),
            status: 'draft',
            workflowStatus: 'not_submitted',
            content: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        let needsDbUpdate = !existingCiData;

        // 1. Ensure themeId is set (random assign if missing)
        if (!ciData.themeId) {
            ciData.themeId = assignRandomTheme();
            needsDbUpdate = true;
        }

        // 2. Ensure content.hero exists
        const content = (ciData.content as Record<string, any>) || {};
        const hero = (content.hero as Record<string, any>) || {};

        // 3. If avatar is missing, query gender and assign
        if (!hero.profileImageUrl) {
            try {
                const crm = await crmUserRepository.findByEmailOrAppEmail(email);
                const { gender } = await fetchClientGender(crm?.email || email, crm?.company_application_email || email);
                if (gender) {
                    hero.gender = gender;
                    const avatar = assignRandomAvatar(gender);
                    if (avatar) {
                        hero.profileImageUrl = avatar;
                    }
                    content.hero = hero;
                    ciData.content = content;
                    needsDbUpdate = true;
                }
            } catch (err) {
                console.warn(`[CareerIdentity] Failed to fetch gender on initialization for ${email}:`, err);
            }
        }

        // 4. Ensure clarity configuration block exists with disabled default
        if (!ciData.clarity) {
            ciData.clarity = {
                projectId: null,
                accountEmail: null,
                accountType: null,
                role: 'member',
                status: 'disabled',
                clientConsent: {
                    accepted: false,
                    acceptedAt: null,
                    revokedAt: null,
                },
                notes: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            needsDbUpdate = true;
        }

        if (needsDbUpdate) {
            ciData.updatedAt = new Date().toISOString();
            try {
                const db = getDatabase();
                await db
                    .from('profiles')
                    .update({ career_identity_data: ciData })
                    .eq('id', userId);
            } catch (err) {
                console.error(`[CareerIdentity] Could not persist initialized CI data for ${userId}:`, err);
            }
        }

        return ciData;
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

        const ciData = await this.ensureInitializedCareerIdentity(
            userId,
            profile.email,
            (profile as any).career_identity_data as Record<string, unknown> | null
        );

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
        body: {
            content?: Record<string, unknown>;
            status?: string;
            workflowStatus?: string;
            clientConsent?: { accepted: boolean };
        }
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
            castId: resumeId,
            resumeId,
            content: mergedContent,
            updatedAt: now,
        };

        if (body.status) {
            updatedCiData.status = body.status;
        }

        if (body.workflowStatus) {
            updatedCiData.workflowStatus = body.workflowStatus;
        }

        if (body.clientConsent !== undefined) {
            const isAccepted = typeof body.clientConsent === 'boolean'
                ? body.clientConsent
                : !!(body.clientConsent as any)?.accepted;

            const existingClarity = (existingCiData.clarity as Record<string, any>) || {
                projectId: null,
                accountEmail: null,
                accountType: null,
                role: 'member',
                status: 'disabled',
                notes: null,
            };

            const existingConsent = existingClarity.clientConsent || {};
            const acceptedAt = isAccepted ? now : (existingConsent.acceptedAt || null);
            const revokedAt = !isAccepted ? now : null;

            updatedCiData.clarity = {
                ...existingClarity,
                projectId: existingClarity.projectId ?? null,
                accountEmail: existingClarity.accountEmail ?? null,
                accountType: existingClarity.accountType ?? null,
                role: 'member',
                status: isAccepted ? (existingClarity.projectId ? 'active' : 'pending') : 'disabled',
                clientConsent: {
                    accepted: isAccepted,
                    acceptedAt,
                    revokedAt,
                },
                updatedAt: now,
            };
        } else if (!updatedCiData.clarity) {
            updatedCiData.clarity = {
                projectId: null,
                accountEmail: null,
                accountType: null,
                role: 'member',
                status: 'disabled',
                clientConsent: {
                    accepted: false,
                    acceptedAt: null,
                    revokedAt: null,
                },
                notes: null,
                createdAt: now,
                updatedAt: now,
            };
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
    async listRequests(filter?: { workflowStatus?: string; status?: string; clarityStatus?: string }): Promise<any[]> {
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
            const project = await getProject(profile.id);
            if (project?.pending_submission_id || project?.published_submission_id) {
                const submission = await getSubmission(project.pending_submission_id ?? project.published_submission_id);
                const workflowStatus = submission.workflow_status;
                const status = project.published_submission_id || (profile.career_identity_data as any)?.status === 'published' ? 'published' : 'draft';
                const clarityStatus = project.clarity_settings?.status ?? 'disabled';
                if ((filter?.workflowStatus && filter.workflowStatus !== workflowStatus) ||
                    (filter?.status && filter.status !== status) || (filter?.clarityStatus && filter.clarityStatus !== clarityStatus)) continue;
                results.push({
                    userId: profile.id, email: profile.email, fullName: profile.full_name || profile.first_name,
                    workflowStatus, status, themeId: submission.theme_id, submissionDate: submission.submitted_at,
                    updatedAt: submission.updated_at, clarityStatus, submissionId: submission.id,
                    clarityClientConsent: project.clarity_settings?.clientConsent?.accepted ?? false,
                    assets: { resumeId: submission.source_cast_id },
                });
                continue;
            }

            const ciData = (profile.career_identity_data as Record<string, unknown>) || {};
            let workflowStatus = (ciData.workflowStatus as string) || 'not_submitted';
            const status = (ciData.status as string) || 'draft';
            if (project && status !== 'published' && workflowStatus !== 'not_submitted'
                && await hasWithdrawnSubmission(project.id)) {
                workflowStatus = 'not_submitted';
            }
            const clarity = project?.clarity_settings ?? ciData.clarity as any;
            const clarityStatus = clarity?.status || 'disabled';

            // Apply optional filters
            if (filter?.workflowStatus && workflowStatus !== filter.workflowStatus) continue;
            if (filter?.status && status !== filter.status) continue;
            if (filter?.clarityStatus && clarityStatus !== filter.clarityStatus) continue;

            const preferredCastId = (ciData.castId as string) || (ciData.resumeId as string) || null;
            const { job: firstJob, resumeUrl } = await this.findLatestResume(profile.id, profile.email, preferredCastId);

            let introVideoUrl: string | null = null;
            if (firstJob?.id) {
                const jobId = firstJob.id;
                const [crmVideos, regVideos] = await Promise.all([
                    db.from('crm_recordings').select('video_url').eq('job_request_id', jobId).order('created_at', { ascending: false }).limit(1),
                    db.from('recordings').select('storage_path').eq('job_request_id', jobId).order('created_at', { ascending: false }).limit(1),
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

            // Fallback: if no video on the selected job, check user's latest recording overall
            if (!introVideoUrl) {
                const [userCrmVideos, userRegVideos] = await Promise.all([
                    db.from('crm_recordings').select('video_url').or(profile.email ? `user_id.eq.${profile.id},email.eq.${profile.email}` : `user_id.eq.${profile.id}`).order('created_at', { ascending: false }).limit(1),
                    db.from('recordings').select('storage_path').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(1),
                ]);
                const uCrm = (userCrmVideos.data as any[])?.[0]?.video_url;
                const uReg = (userRegVideos.data as any[])?.[0]?.storage_path;
                const uRaw = uCrm || uReg;
                if (uRaw) {
                    introVideoUrl = this.resolveStorageUrl(
                        uRaw,
                        userCrmVideos.data?.length ? 'CRM_users_recordings' : 'recordings'
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
                submissionDate: workflowStatus === 'not_submitted' ? null : ciData.createdAt || null,
                createdAt: profile.created_at,
                updatedAt: ciData.updatedAt || profile.updated_at,
                clarityStatus,
                clarityClientConsent: clarity?.clientConsent?.accepted || false,
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
     * Finds the candidate's primary Career Identity resume & job request.
     * 1. If preferredCastId is given (e.g. pinned in career_identity_data), checks if it exists in candidate's records.
     * 2. Otherwise finds the newest job request across crm_job_requests and job_requests,
     *    prioritizing rows that have an actual uploaded resume and ordering by created_at DESC.
     */
    private async findLatestResume(userId: string, email?: string | null, preferredCastId?: string | null): Promise<{
        job: any | null;
        resumeUrl: string | null;
        isCRM: boolean;
        bucket: string;
    }> {
        const db = getDatabase();

        const [crmRes, regRes] = await Promise.all([
            db.from('crm_job_requests')
                .select('id, resume_url, job_title, job_description, created_at, updated_at')
                .or(email ? `user_id.eq.${userId},email.eq.${email}` : `user_id.eq.${userId}`)
                .order('created_at', { ascending: false }),
            db.from('job_requests')
                .select('id, resume_path, job_title, job_description, created_at, updated_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false }),
        ]);

        interface CandidateRow {
            id: string;
            rawResume: string | null;
            isCRM: boolean;
            bucket: string;
            createdTime: number;
            record: any;
        }

        const allRows: CandidateRow[] = [
            ...(crmRes.data || []).map((row: any) => ({
                id: row.id,
                rawResume: row.resume_url?.trim() || null,
                isCRM: true,
                bucket: 'CRM_users_resumes',
                createdTime: new Date(row.created_at || 0).getTime(),
                record: row,
            })),
            ...(regRes.data || []).map((row: any) => ({
                id: row.id,
                rawResume: row.resume_path?.trim() || null,
                isCRM: false,
                bucket: 'resumes',
                createdTime: new Date(row.created_at || 0).getTime(),
                record: row,
            })),
        ];

        if (allRows.length === 0) {
            console.log(`[ResumeSelector] Candidate ${userId}: No job requests found in crm_job_requests or job_requests`);
            return { job: null, resumeUrl: null, isCRM: false, bucket: 'resumes' };
        }

        // 1. If preferredCastId is given and matches candidate's records, select it
        if (preferredCastId) {
            const preferredMatch = allRows.find(r => r.id === preferredCastId);
            if (preferredMatch) {
                const resumeUrl = this.resolveStorageUrl(preferredMatch.rawResume, preferredMatch.bucket);
                console.log(`[ResumeSelector] Candidate ${userId}: Selected preferred castId ${preferredCastId} from ${preferredMatch.bucket}`);
                return {
                    job: preferredMatch.record,
                    resumeUrl,
                    isCRM: preferredMatch.isCRM,
                    bucket: preferredMatch.bucket,
                };
            }
        }

        // 2. Separate rows with valid resume vs rows without
        const rowsWithResume = allRows.filter(r => !!r.rawResume);
        const pool = rowsWithResume.length > 0 ? rowsWithResume : allRows;

        // Sort descending: highest created_at = newest job request
        pool.sort((a, b) => b.createdTime - a.createdTime);

        const latest = pool[0];
        const resumeUrl = this.resolveStorageUrl(latest.rawResume, latest.bucket);
        console.log(`[ResumeSelector] Candidate ${userId}: Selected primary resume from ${latest.bucket} (ID: ${latest.id}, created: ${new Date(latest.createdTime).toISOString()})`);

        return {
            job: latest.record,
            resumeUrl,
            isCRM: latest.isCRM,
            bucket: latest.bucket,
        };
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

        const project = await getProject(userId);
        const submission = await getSubmission(project?.pending_submission_id ?? project?.published_submission_id ?? null);
        if (submission) {
            const live = project?.published_submission_id === submission.id ? submission
                : await getSubmission(project?.published_submission_id ?? null);
            const content = live && live.id !== submission.id ? {
                ...submission.content,
                hero: { ...submission.content?.hero, profileImageUrl: live.content?.hero?.profileImageUrl },
            } : submission.content;
            const comparison = live && live.id !== submission.id ? {
                resumeChanged: submission.resume_asset_ref !== live.resume_asset_ref,
                videoChanged: submission.video_asset_ref !== live.video_asset_ref,
                contentSections: ['hero', 'about', 'skills', 'education', 'experience', 'projects', 'certifications', 'achievements', 'contact']
                    .filter(section => {
                        const draft = content?.[section];
                        const published = live.content?.[section];
                        if (section !== 'hero') return !isDeepStrictEqual(draft, published);
                        // Both views use the same client-managed avatar.
                        const withoutAvatar = (hero: Record<string, unknown> = {}) =>
                            Object.fromEntries(Object.entries(hero ?? {}).filter(([key]) => key !== 'profileImageUrl'));
                        return !isDeepStrictEqual(withoutAvatar(draft), withoutAvatar(published));
                    }),
            } : null;
            return {
                userId, email: profile.email, fullName: profile.full_name || profile.first_name,
                tier: profile.tier, workflowStatus: submission.workflow_status,
                status: project?.pending_submission_id ? 'draft' : 'published',
                submissionId: submission.id, publicId: project?.published_submission_id ? project.id : null,
                themeId: live?.theme_id ?? submission.theme_id,
                content, submissionDate: submission.submitted_at,
                versionNumber: submission.version_number,
                publishedAt: submission.published_at,
                publishedVersion: comparison ? {
                    versionNumber: live.version_number, publishedAt: live.published_at,
                    themeId: live.theme_id, content: live.content, submissionDate: live.submitted_at,
                    updatedAt: live.updated_at, assets: await this.versionAssets(live),
                } : null,
                comparison,
                createdAt: profile.created_at, updatedAt: submission.updated_at, clarity: project?.clarity_settings,
                walletPassUrl: submission.content?.walletPassUrl ?? null,
                assets: await this.versionAssets(submission),
            };
        }
        const legacy = profile.career_identity_data as any;
        if (legacy?.status !== 'published' && (
            !legacy?.workflowStatus || legacy.workflowStatus === 'not_submitted' ||
            (project && await hasWithdrawnSubmission(project.id))
        )) throw new NotFoundError('Career Identity submission');

        const ciData = await this.ensureInitializedCareerIdentity(
            profile.id,
            profile.email,
            profile.career_identity_data as Record<string, unknown> | null
        );
        console.log(`[DIAG-GET] getRequest(${userId}): raw ciData.walletCardUrl=${ciData.walletCardUrl || 'null'}, walletCardStatus=${ciData.walletCardStatus || 'null'}`);

        const preferredCastId = (ciData.castId as string) || (ciData.resumeId as string) || null;
        // Find candidate's primary resume across crm_job_requests and job_requests
        const { job: firstJob, resumeUrl } = await this.findLatestResume(userId, profile.email, preferredCastId);

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

        // Fallback: if no video on the selected job, check user's latest recording overall
        if (!introVideoUrl) {
            const [userCrmVideos, userRegVideos] = await Promise.all([
                db.from('crm_recordings').select('video_url, created_at').or(profile.email ? `user_id.eq.${userId},email.eq.${profile.email}` : `user_id.eq.${userId}`).order('created_at', { ascending: false }).limit(1),
                db.from('recordings').select('storage_path, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1),
            ]);
            const uCrm = (userCrmVideos.data as any[])?.[0];
            const uReg = (userRegVideos.data as any[])?.[0];
            const uRaw = uCrm?.video_url || uReg?.storage_path || null;
            if (uRaw) {
                introVideoUrl = this.resolveStorageUrl(uRaw, userCrmVideos.data?.length ? 'CRM_users_recordings' : 'recordings');
                recordingCreatedAt = uCrm?.created_at || uReg?.created_at || null;
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
            clarity: project?.clarity_settings ?? ciData.clarity ?? {
                projectId: null,
                accountEmail: null,
                accountType: null,
                role: 'member',
                status: 'disabled',
                clientConsent: { accepted: false, acceptedAt: null },
                notes: null,
            },
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
     * Admin: Auto-fills Career Identity profile content using the candidate's latest resume.
     * Passes the resume to the internal ApplyWizard parser API and adapts it.
     * Integrates onboarding gender lookup to assign random avatar and theme if not already set.
     * NOTE: Does NOT write to database — only returns content & themeId for admin review in UI.
     */
    async autoFillFromResume(userId: string, submissionId?: string): Promise<{ content: Record<string, unknown>; themeId: string }> {
        const db = getDatabase();

        // 1. Fetch user profile (using verified existing columns)
        const { data: profile, error: profileError } = await db
            .from('profiles')
            .select('id, email, full_name, first_name, tier, career_identity_data')
            .eq('id', userId)
            .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) throw new NotFoundError('User', userId);

        const project = await getProject(userId);
        if (submissionId || project?.pending_submission_id || project?.published_submission_id) {
            if (!submissionId || submissionId !== project?.pending_submission_id) {
                throw new ConflictError('The editable submission changed. Reopen the request.');
            }
        } else {
            await this.getRequest(userId);
        }
        const submission = submissionId ? await getSubmission(submissionId) : null;
        if (submission && submission.project_id !== project?.id) throw new NotFoundError('Career Identity submission');
        const existingCi = submission ? { content: submission.content, themeId: submission.theme_id }
            : (profile.career_identity_data as Record<string, any>) || {};
        const existingContact = existingCi.content?.contact || {};
        const existingHero = existingCi.content?.hero || {};

        // Resolve avatar & gender if not already present
        let assignedAvatar: string | null = existingHero.profileImageUrl || null;
        let assignedGender: 'Male' | 'Female' | null = existingHero.gender || null;

        if (!assignedAvatar) {
            try {
                const crm = await crmUserRepository.findByEmailOrAppEmail(profile.email);
                const { gender } = await fetchClientGender(crm?.email || profile.email, crm?.company_application_email || profile.email);
                if (gender) {
                    assignedGender = gender;
                    assignedAvatar = assignRandomAvatar(gender);
                }
            } catch (err) {
                console.warn(`[AutoFill] Could not fetch gender for ${profile.email}:`, err);
            }
        }

        const chosenTheme = existingCi.themeId || assignRandomTheme();

        const attachHeroDetails = (content: Record<string, any>) => {
            if (!content.hero) content.hero = {};
            if (assignedAvatar) {
                content.hero.profileImageUrl = assignedAvatar;
            }
            if (assignedGender) {
                content.hero.gender = assignedGender;
            }
            return content;
        };

        // 2. Fetch portfolio link if available (catch gracefully if table doesn't exist)
        let portfolioUrl: string | null = null;
        try {
            const { data: portfolio } = await db
                .from('portfolio_settings')
                .select('url')
                .eq('user_id', userId)
                .maybeSingle();
            if (portfolio?.url) {
                portfolioUrl = portfolio.url;
            }
        } catch {
            // Non-fatal
        }

        // 3. Find absolute latest resume across crm_job_requests and job_requests
        const preferredCastId = existingCi.castId || existingCi.resumeId || null;
        const { job: firstJob, resumeUrl } = submission
            ? { job: null, resumeUrl: await assetUrl(submission.resume_asset_ref) }
            : await this.findLatestResume(userId, profile.email, preferredCastId);

        const context: AutoFillContext = {
            profile: {
                full_name: profile.full_name,
                first_name: profile.first_name,
                email: profile.email,
                phone: submission ? null : existingContact.phone || null,
                location: submission ? null : existingContact.location || null,
                bio: submission ? null : existingCi.content?.about || null,
            },
            jobRequest: firstJob,
            portfolioUrl,
        };

        if (!resumeUrl) {
            console.warn(`[AutoFill] User ${userId} has no uploaded resume, adapting from DB profile context`);
            const fallbackContent = adaptParserResponse(null, context);
            return { content: attachHeroDetails(fallbackContent), themeId: chosenTheme };
        }

        try {
            console.log(`[AutoFill] Downloading resume for user ${userId} from ${resumeUrl}`);
            const res = await fetch(resumeUrl, submission ? { redirect: 'error', signal: AbortSignal.timeout(30_000) } : undefined);
            if (!res.ok) {
                throw new Error(`Failed to download resume file (${res.status} ${res.statusText})`);
            }
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const parsedResult = await callApplyWizardParser(buffer, 'resume.pdf');
            const content = adaptParserResponse(parsedResult, context);
            return { content: attachHeroDetails(content), themeId: chosenTheme };
        } catch (err: any) {
            console.error(`[AutoFill] Parser failed for user ${userId}, falling back to DB context:`, err);
            if (submission) throw new AppError(502, 'CI_AUTOFILL_FAILED', 'Could not read the submitted PDF. Try again or enter the content manually.');
            // Fallback gracefully so admin still gets pre-filled fields from database
            const fallbackContent = adaptParserResponse(null, context);
            return { content: attachHeroDetails(fallbackContent), themeId: chosenTheme };
        }
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
        clarity?: {
            projectId?: string | null;
            accountEmail?: string | null;
            accountType?: 'company_zoho' | 'client_personal' | null;
            status?: 'disabled' | 'pending' | 'active';
            notes?: string | null;
            clientConsent?: {
                accepted: boolean;
                acceptedAt?: string | null;
                revokedAt?: string | null;
            };
        };
    }): Promise<any> {
        const db = getDatabase();
        const { data: profile, error: fetchError } = await db
            .from('profiles')
            .select('career_identity_data, email')
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
        if (body.clarity !== undefined) {
            const existingClarity = (existingCiData.clarity as Record<string, any>) || {};
            const existingConsent = existingClarity.clientConsent || { accepted: false, acceptedAt: null, revokedAt: null };

            let clientConsent = { ...existingConsent };
            if (body.clarity.clientConsent !== undefined) {
                const bConsent = body.clarity.clientConsent;
                const isAccepted = !!bConsent.accepted;
                clientConsent = {
                    accepted: isAccepted,
                    acceptedAt: bConsent.acceptedAt !== undefined
                        ? bConsent.acceptedAt
                        : (isAccepted ? (existingConsent.acceptedAt || now) : existingConsent.acceptedAt),
                    revokedAt: bConsent.revokedAt !== undefined
                        ? bConsent.revokedAt
                        : (!isAccepted && existingConsent.accepted ? now : (existingConsent.revokedAt || null)),
                };
            }

            const targetStatus = body.clarity.status || existingClarity.status || 'disabled';

            updatedCiData.clarity = {
                ...existingClarity,
                projectId: body.clarity.projectId !== undefined ? body.clarity.projectId : (existingClarity.projectId ?? null),
                accountEmail: body.clarity.accountEmail !== undefined
                    ? (body.clarity.accountEmail ? body.clarity.accountEmail.trim() : null)
                    : (existingClarity.accountEmail ?? null),
                accountType: body.clarity.accountType !== undefined
                    ? body.clarity.accountType
                    : (existingClarity.accountType ?? null),
                role: 'member',
                status: targetStatus,
                clientConsent,
                notes: body.clarity.notes !== undefined ? body.clarity.notes : (existingClarity.notes ?? null),
                updatedAt: now,
            };
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
            .select('id, email, full_name, first_name, career_identity_data')
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

        // Find the user's primary castId (resume ID)
        const preferredCastId = (ciData.castId as string) || (ciData.resumeId as string) || null;
        const { job: firstJob } = await this.findLatestResume(userId, profile.email, preferredCastId);
        const castId: string | null = preferredCastId || firstJob?.id || null;
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
            linkedin: (contact.linkedin as string) || null,
            profileImageUrl: (hero.profileImageUrl as string) || null,
            careerIdentityUrl: `${CARD_BASE_URL}/career-identity/${castId}`,
            castId,
            company: firstJob?.company_name || null,
            verified: !!hero.verified,
            openToWork: !!hero.openToWork,
            openToRelocate: !!hero.openToRelocate,
            remote: !!hero.remote,
            immediateJoiner: !!hero.immediateJoiner,
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
