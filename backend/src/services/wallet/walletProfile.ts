import { getProject, getSubmission } from '../careerIdentity/submissions.service.js';
import { profileRepository } from '../../repositories/profile.repository.js';
import { crmJobRequestRepository } from '../../repositories/crmJobRequest.repository.js';
import { jobRequestRepository } from '../../repositories/jobRequest.repository.js';
import { subscriptionService } from '../subscription/subscription.service.js';
import { ForbiddenError, NotFoundError } from '../../types/errors.js';
import { getDatabase } from '../../config/database.js';
import type { WalletCardData } from './wallet.types.js';

const DEFAULT_WALLET_GREETING = "Hi ✋, I'm";

function normalizeWalletTitle(...values: Array<string | null | undefined>): string | null {
    for (const value of values) {
        const trimmed = value?.trim();
        if (!trimmed) continue;
        if (trimmed.toLowerCase() === 'new digital resume') continue;
        return trimmed;
    }
    return DEFAULT_WALLET_GREETING;
}

export function publicCareerIdentityUrl(castId: string): string {
    const base = (process.env.CAREER_IDENTITY_PUBLIC_URL || 'https://applywizz.com').replace(/\/$/, '');
    if (base.includes('/career-identity/')) {
        return base;
    }
    return `${base}/career-identity/${castId}`;
}

export async function resolveCastRecord(castId: string): Promise<{ record: any; isCRM: boolean }> {
    const [crmResult, regularResult] = await Promise.all([
        crmJobRequestRepository.findOne({ id: castId } as any),
        jobRequestRepository.findOne({ id: castId } as any),
    ]);
    const record = crmResult || regularResult;
    if (!record) {
        throw new NotFoundError('Career Identity profile', castId);
    }
    return { record, isCRM: !!crmResult };
}

/**
 * Public visitors may download a pass only when the profile is published.
 * The owner may always generate a pass for their own unpublished draft.
 */
export async function assertWalletAccess(castId: string, authenticatedUserId?: string): Promise<{
    record: any;
    userId: string;
    published: boolean;
}> {
    const directProject = await getProject(castId, true);
    const directVersion = await getSubmission(directProject?.published_submission_id ?? null);
    if (directProject && !directVersion) throw new NotFoundError('Career Identity profile', castId);
    const { record } = directProject ? { record: { user_id: directProject.user_id } } : await resolveCastRecord(castId);
    const userId: string | null = record.user_id || null;
    if (!userId) {
        throw new NotFoundError('Career Identity profile', castId);
    }

    const { tier } = await subscriptionService.getEffectiveUserTier(userId);
    if (tier !== 'career_identity') {
        throw new ForbiddenError('Wallet passes are only available for Career Identity profiles.');
    }

    const profile = await profileRepository.findById(userId);
    const ciData = (profile?.career_identity_data || {}) as Record<string, any>;
    const project = directProject ?? await getProject(userId);
    const published = !!project?.published_submission_id || ciData.status === 'published';
    const isOwner = !!authenticatedUserId && authenticatedUserId === userId;

    if (!published && !isOwner) {
        throw new NotFoundError('Career Identity profile', castId);
    }

    return { record, userId, published };
}

function calculateExperienceYears(expList?: any[], fallback?: any): string {
    if (fallback) {
        const str = String(fallback).trim();
        const match = str.match(/\d+/);
        if (match) return `${match[0]}+`;
        return str;
    }
    if (!Array.isArray(expList) || expList.length === 0) return '3+';
    let totalMonths = 0;
    for (const item of expList) {
        if (!item?.startDate) continue;
        const start = new Date(item.startDate);
        const end = item.endDate && item.endDate.toLowerCase() !== 'present' ? new Date(item.endDate) : new Date();
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
            if (months > 0) totalMonths += months;
        }
    }
    const years = Math.max(1, Math.round(totalMonths / 12));
    return `${years}`;
}

async function resolveCandidateAssets(castId: string, record: any, userId: string) {
    const isCRM = 'company_application_email' in record || 'resume_url' in record;
    const db = getDatabase();

    // 1. Resume
    const rawResume = record.resume_url || record.resume_path;
    let resumeUrl: string | null = null;
    if (rawResume) {
        if (rawResume.startsWith('http://') || rawResume.startsWith('https://')) {
            resumeUrl = rawResume;
        } else {
            const bucket = isCRM ? 'CRM_users_resumes' : 'resumes';
            try {
                resumeUrl = db.storage.from(bucket).getPublicUrl(rawResume).data?.publicUrl ?? null;
            } catch { /* ignore */ }
        }
    }

    // 2. Video
    let videoUrl: string | null = null;
    try {
        if (isCRM) {
            const { data: crmVideo } = await db
                .from('crm_recordings')
                .select('video_url')
                .eq('job_request_id', castId)
                .order('created_at', { ascending: false })
                .limit(1);
            if (crmVideo?.[0]?.video_url) {
                const raw = crmVideo[0].video_url;
                videoUrl = raw.startsWith('http') ? raw : db.storage.from('CRM_users_recordings').getPublicUrl(raw).data?.publicUrl ?? null;
            }
        } else {
            const { data: regVideo } = await db
                .from('recordings')
                .select('storage_path')
                .eq('job_request_id', castId)
                .order('created_at', { ascending: false })
                .limit(1);
            if (regVideo?.[0]?.storage_path) {
                const raw = regVideo[0].storage_path;
                videoUrl = raw.startsWith('http') ? raw : db.storage.from('recordings').getPublicUrl(raw).data?.publicUrl ?? null;
            }
        }
    } catch { /* ignore */ }

    // 3. Portfolio
    let portfolioUrl: string | null = null;
    try {
        const { data: portfolio } = await db
            .from('portfolio_settings')
            .select('url')
            .eq('user_id', userId)
            .maybeSingle();
        if (portfolio?.url) portfolioUrl = portfolio.url;
    } catch { /* ignore */ }

    return { resumeUrl, videoUrl, portfolioUrl };
}

export async function loadWalletCardData(castId: string, record: any, userId: string): Promise<WalletCardData> {
    const userProfile = await profileRepository.findById(userId);
    const ciData = (userProfile?.career_identity_data || {}) as Record<string, any>;
    const project = await getProject(userId);
    const version = await getSubmission(project?.published_submission_id ?? null);
    const content: Record<string, any> = version?.content ?? ciData.content ?? {};
    const publicId = version ? project!.id : castId;
    const hero: Record<string, any> = content.hero || {};
    const contact: Record<string, any> = content.contact || {};

    const assets = await resolveCandidateAssets(version?.source_cast_id ?? castId, record, userId);
    if (version) {
        const apiBase = process.env.BACKEND_PUBLIC_URL || process.env.API_BASE_URL || process.env.RENDER_EXTERNAL_URL;
        const publicPage = publicCareerIdentityUrl(publicId);
        const assetBase = apiBase ? `${apiBase.replace(/\/$/, '')}/api/v1/career-identity/profile/public/${publicId}/assets` : null;
        assets.resumeUrl = assetBase ? `${assetBase}/resume` : publicPage;
        assets.videoUrl = assetBase ? `${assetBase}/video` : `${publicPage}?autoPlayVideo=true`;
    }

    const skillsCount = Array.isArray(content.skills) && content.skills.length > 0 ? content.skills.length : 12;
    const projectsCount = Array.isArray(content.projects) && content.projects.length > 0 ? content.projects.length : 8;
    const experienceYears = calculateExperienceYears(content.experience, hero.experienceYears);
    const bookingUrl = `${publicCareerIdentityUrl(publicId)}?action=schedule`;
    const openToWork = hero.openToWork !== undefined ? !!hero.openToWork : true;
    const openToWorkText = hero.openToWorkText || hero.tagline || hero.headline || 'Looking for full-time and contract opportunities in AI/ML, Data Analytics and related roles.';

    return {
        fullName: hero.fullName || userProfile?.full_name || userProfile?.first_name || null,
        jobTitle: normalizeWalletTitle(hero.headline, record.job_title),
        headline: hero.headline || null,
        location: contact.location || null,
        email: contact.email || userProfile?.email || null,
        phone: contact.phone || null,
        linkedin: contact.linkedin || null,
        profileImageUrl: hero.profileImageUrl || null,
        careerIdentityUrl: publicCareerIdentityUrl(publicId),
        castId: publicId,
        company: record.company_name || null,
        verified: hero.verified !== undefined ? !!hero.verified : true,
        openToWork,
        openToRelocate: !!hero.openToRelocate,
        remote: !!hero.remote,
        immediateJoiner: !!hero.immediateJoiner,
        experienceYears,
        skillsCount,
        projectsCount,
        resumeUrl: assets.resumeUrl,
        videoUrl: assets.videoUrl,
        portfolioUrl: contact.website || assets.portfolioUrl,
        bookingUrl,
        openToWorkText: openToWork ? openToWorkText : null,
    };
}

export async function getWalletStatus(castId: string, authenticatedUserId?: string) {
    const { record, userId } = await assertWalletAccess(castId, authenticatedUserId);
    const profile = await profileRepository.findById(userId);
    const ciData = (profile?.career_identity_data || {}) as Record<string, any>;

    const project = await getProject(userId);
    const version = await getSubmission(project?.published_submission_id ?? null);
    const wallet = version ? version.content : ciData;

    const appleReady = !!(
        process.env.APPLE_PASS_TYPE_IDENTIFIER &&
        process.env.APPLE_TEAM_IDENTIFIER &&
        process.env.APPLE_PASS_SIGNER_CERT_BASE64 &&
        process.env.APPLE_PASS_SIGNER_KEY_BASE64 &&
        process.env.APPLE_WWDR_CERT_BASE64
    );
    const googleReady = !!(
        process.env.GOOGLE_WALLET_ISSUER_ID &&
        (process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY)
    );

    return {
        apple: appleReady,
        google: googleReady,
        visualCard: true,
        walletPassUrl: (wallet.walletPassUrl as string) || null,
        walletCardUrl: (wallet.walletCardUrl as string) || null,
    };
}
