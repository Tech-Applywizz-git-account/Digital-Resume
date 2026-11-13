import { getDatabase } from '../../config/database.js';
import { environment } from '../../config/environment.js';
import { AppError, ConflictError, ForbiddenError } from '../../types/errors.js';
import { subscriptionService } from '../subscription/subscription.service.js';
import { AVAILABLE_THEMES, assignRandomAvatar, assignRandomTheme, fetchClientGender } from './clientOnboarding.service.js';
import { logger } from '../../logger/index.js';
import { crmUserRepository } from '../../repositories/crmUser.repository.js';

const bucket = 'career-identity-submissions';
function submissionSetupError() {
    return new AppError(503, 'CI_SUBMISSION_SETUP_REQUIRED',
        'Career Identity submissions are temporarily unavailable. Please contact support.');
}

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export async function getProject(value: string, byId = false) {
    if (!uuid.test(value)) return null;
    const { data, error } = await getDatabase().from('career_identity_projects')
        .select('*').eq(byId ? 'id' : 'user_id', value).maybeSingle();
    if (error) throw error;
    return data;
}

export async function getSubmission(id: string | null) {
    if (!id) return null;
    const { data, error } = await getDatabase().from('career_identity_submissions').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
}

function requireSourceUrl(url: string): string {
    const parsed = URL.canParse(url) ? new URL(url) : null;
    const supabaseOrigin = new URL(environment.supabaseUrl).origin;
    const isSupabaseObject = parsed?.origin === supabaseOrigin && parsed.pathname.startsWith('/storage/v1/object/public/');
    const isCrmObject = parsed?.origin === 'https://applywizz-prod.s3.us-east-2.amazonaws.com';
    if (!parsed || parsed.username || parsed.password || (!isSupabaseObject && !isCrmObject)) {
        throw new AppError(422, 'CI_ASSET_HOST', 'This file cannot be used. Upload it again from Digital Resume.');
    }
    return url;
}

export async function assetUrl(path: string) {
    if (URL.canParse(path)) return requireSourceUrl(path);
    // Older submissions may still point to a retained object in the private bucket.
    const { data, error } = await getDatabase().storage.from(bucket).createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
}

function sourceUrl(path: string, sourceBucket: string) {
    if (/^https?:\/\//i.test(path)) return path;
    return getDatabase().storage.from(sourceBucket).getPublicUrl(path).data.publicUrl;
}

export async function eligibleResumes(userId: string) {
    const db = getDatabase();
    const sources = [
        { jobs: 'crm_job_requests', status: 'application_status', resume: 'resume_url', recordings: 'crm_recordings', video: 'video_url', resumeBucket: 'CRM_users_resumes', videoBucket: 'CRM_users_recordings' },
        { jobs: 'job_requests', status: 'status', resume: 'resume_path', recordings: 'recordings', video: 'storage_path', resumeBucket: 'resumes', videoBucket: 'recordings' },
    ];

    const results = await Promise.all(sources.map(async source => {
        const { data, error } = await db.from(source.jobs).select(`id, created_at, ${source.status}, ${source.resume}`)
            .eq('user_id', userId).order('created_at', { ascending: false }).order('id', { ascending: true });
        if (error) throw error;
        const entries = (data ?? []) as unknown as Array<Record<string, string>>;
        const jobs = entries
            .map((job, index) => ({ job, recordingNumber: entries.length - index }))
            .filter(({ job }) => job[source.status] === 'recorded' && job[source.resume]?.trim());
        if (!jobs.length) return [];

        const recordings = await db.from(source.recordings).select(`id, job_request_id, ${source.video}`)
            .in('job_request_id', jobs.map(({ job }) => job.id)).not(source.video, 'is', null)
            .order('created_at', { ascending: false }).order('id', { ascending: false });
        if (recordings.error) throw recordings.error;
        const videos = (recordings.data ?? []) as unknown as Array<Record<string, string>>;
        return jobs.flatMap(({ job, recordingNumber }) => {
            const video = videos.find(row => row.job_request_id === job.id && row[source.video]?.trim());
            if (!video) return [];
            return [{
                castId: job.id, source: source.jobs, recordingNumber, createdAt: job.created_at,
                recordingId: video.id, recordingSource: source.recordings,
                resumeUrl: sourceUrl(job[source.resume], source.resumeBucket),
                videoUrl: sourceUrl(video[source.video], source.videoBucket),
            }];
        });
    }));
    return results.flat().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.castId.localeCompare(b.castId));
}

export async function submitCareerIdentity(userId: string, input: Record<string, unknown>) {
    const { tier } = await subscriptionService.getEffectiveUserTier(userId);
    if (tier !== 'career_identity') throw new ForbiddenError('Career Identity access required');
    const { castId, source, recordingId, resumeUrl, videoUrl, idempotencyKey, expectedPendingId } = input;
    if (typeof idempotencyKey !== 'string' || !uuid.test(idempotencyKey) ||
        (expectedPendingId != null && (typeof expectedPendingId !== 'string' || !uuid.test(expectedPendingId)))) {
        throw new AppError(422, 'CI_INVALID_SELECTION', 'Invalid submission confirmation. Reopen the picker.');
    }

    const db = getDatabase();
    const project = await getProject(userId);
    if (project) {
        const retry = await db.from('career_identity_submissions').select('id, source_cast_id, source_type, recording_id')
            .eq('project_id', project.id).eq('idempotency_key', idempotencyKey).maybeSingle();
        if (retry.error) throw retry.error;
        if (retry.data) {
            if (retry.data.source_cast_id !== castId || retry.data.source_type !== source || retry.data.recording_id !== recordingId) {
                throw new ConflictError('This confirmation was already used for another selection.');
            }
            return { id: retry.data.id };
        }
    }
    if ((project?.pending_submission_id ?? null) !== (expectedPendingId ?? null)) {
        throw new ConflictError('The pending submission changed. Refresh and try again.');
    }

    const selected = (await eligibleResumes(userId)).find(item => item.castId === castId && item.source === source);
    if (!selected || selected.recordingId !== recordingId || selected.resumeUrl !== resumeUrl || selected.videoUrl !== videoUrl) {
        throw new ConflictError('The selected files changed. Reopen the picker and preview them again.');
    }

    const { data: profile, error: profileError } = await db.from('profiles').select('email, career_identity_data').eq('id', userId).maybeSingle();
    if (profileError) throw profileError;
    const prior = await getSubmission(project?.pending_submission_id ?? project?.published_submission_id ?? null);
    const legacy = profile?.career_identity_data;
    const theme = prior?.theme_id ?? legacy?.themeId;
    const content = { ...(prior?.content ?? legacy?.content ?? {}) };
    // Wallet artifacts are generated from the published version.
    delete content.walletPassUrl;
    delete content.walletCardUrl;

    if (!prior && !content.hero?.profileImageUrl && profile?.email) {
        try {
            const crm = await crmUserRepository.findByEmailOrAppEmail(profile.email);
            const { gender } = await fetchClientGender(crm?.email || profile.email, crm?.company_application_email || profile.email);
            if (gender) content.hero = { ...content.hero, gender, profileImageUrl: assignRandomAvatar(gender) };
        } catch (error) {
            console.warn('[Career Identity] Optional avatar lookup failed', error);
        }
    }

    const current = (await eligibleResumes(userId)).find(item => item.castId === castId && item.source === source);
    if (!current || current.recordingId !== recordingId || current.resumeUrl !== resumeUrl || current.videoUrl !== videoUrl) {
        throw new ConflictError('The selected files changed. Reopen the picker and preview them again.');
    }

    const { data, error } = await db.rpc('ci_submit', {
        p_user: userId, p_expected: expectedPendingId ?? null,
        p_data: {
            idempotency_key: idempotencyKey, source_type: selected.source, source_cast_id: selected.castId,
            recording_source: selected.recordingSource, recording_id: selected.recordingId,
            resume_asset_ref: requireSourceUrl(current.resumeUrl), video_asset_ref: requireSourceUrl(current.videoUrl), content,
            theme_id: ['aurora', 'zenith', 'atlas'].includes(theme) ? theme : assignRandomTheme(),
            clarity_settings: legacy?.clarity ?? {},
        },
    });
    const saved = Array.isArray(data) ? data[0] : data;
    const missingSubmitFunction = error?.code === 'PGRST202' || error?.code === '42883';
    if (error?.code === '40001') throw new ConflictError(error.message);
    if (error) {
        logger.error({ err: error, operation: 'ci_submit' }, 'Career Identity submission database save failed');
        if (missingSubmitFunction) throw submissionSetupError();
        throw new AppError(502, 'CI_SUBMISSION_SAVE_FAILED', 'Could not save your submission. Please try again.');
    }
    if (!saved?.id) throw new AppError(502, 'CI_SUBMISSION_UNCONFIRMED', 'Unable to confirm the submission. Please retry.');
    return { id: saved.id as string };
}

export async function withdrawCareerIdentitySubmission(userId: string, submissionId: string) {
    if (!uuid.test(submissionId)) throw new AppError(422, 'CI_INVALID_SUBMISSION', 'Invalid submission ID.');

    const { tier } = await subscriptionService.getEffectiveUserTier(userId);
    if (tier !== 'career_identity') throw new ForbiddenError('Career Identity access required');

    const { error } = await getDatabase().rpc('ci_withdraw_submission', {
        p_user: userId,
        p_submission: submissionId,
    });
    if (error?.code === '40001') throw new ConflictError(error.message);
    if (error) {
        logger.error({ err: error, operation: 'ci_withdraw_submission' }, 'Career Identity withdrawal failed');
        if (error.code === 'PGRST202' || error.code === '42883') {
            throw new AppError(503, 'CI_WITHDRAW_SETUP_REQUIRED', 'Submission withdrawal is temporarily unavailable.');
        }
        throw error;
    }
}

export async function hasWithdrawnSubmission(projectId: string): Promise<boolean> {
    const { data, error } = await getDatabase().from('career_identity_submissions')
        .select('id').eq('project_id', projectId).eq('workflow_status', 'withdrawn').limit(1);
    if (error) throw error;
    return !!data?.length;
}

export async function updatePublishedAppearance(userId: string, input: Record<string, unknown>) {
    const { submissionId, themeId, avatar } = input;
    if (typeof submissionId !== 'string' || !uuid.test(submissionId) ||
        !AVAILABLE_THEMES.some(theme => theme === themeId) ||
        (avatar !== undefined && avatar !== null &&
            (typeof avatar !== 'string' || !/^\/Avatar_profile\/(?:[1-9]|1[0-6])\.jpg$/.test(avatar)))) {
        throw new AppError(422, 'CI_INVALID_APPEARANCE', 'Choose a supported theme and avatar.');
    }

    const { tier } = await subscriptionService.getEffectiveUserTier(userId);
    if (tier !== 'career_identity') throw new ForbiddenError('Career Identity access required');

    const { error } = await getDatabase().rpc('ci_update_appearance', {
        p_user: userId, p_submission: submissionId, p_theme: themeId,
        p_avatar: avatar ?? null, p_change_avatar: avatar !== undefined,
    });
    if (error?.code === '40001') throw new ConflictError(error.message);
    if (error?.code === 'PGRST202' || error?.code === '42883') {
        throw new AppError(503, 'CI_APPEARANCE_SETUP_REQUIRED', 'Appearance editing is temporarily unavailable.');
    }
    if (error) throw error;
}
