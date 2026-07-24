import { crmJobRequestRepository } from '../../repositories/crmJobRequest.repository.js';
import { jobRequestRepository } from '../../repositories/jobRequest.repository.js';
import { profileRepository } from '../../repositories/profile.repository.js';
import { portfolioRepository } from '../../repositories/portfolio.repository.js';
import { crmRecordingRepository, recordingRepository } from '../../repositories/recording.repository.js';
import { crmUserRepository } from '../../repositories/crmUser.repository.js';
import { subscriptionService } from '../subscription/subscription.service.js';
import { storageService } from '../storage/storage.service.js';
import { NotFoundError } from '../../types/errors.js';

export interface ResolvedResume {
    castId: string;
    jobTitle: string | null;
    email: string | null;
    candidateName: string | null;
    resumeUrl: string | null;
    videoUrl: string | null;
    portfolioUrl: string | null;
    tier: string | null;
    userId: string | null;
}

export interface CreateJobRequestParams {
    userId: string;
    email: string;
    jobTitle: string;
    jobDescription: string;
}

export interface UploadResumeParams {
    userId: string;
    email: string;
    fileBuffer: Buffer;
    originalName: string;
    mimeType: string;
    jobRequestId: string;
}

export class ResumeService {
    /**
     * Determines whether the authenticated user is a CRM user
     * by querying the digital_resume_by_crm table.
     * The original frontend used getUserInfo(user.id) which checked
     * both email and company_application_email.
     */
    private async resolveCrmStatus(email: string): Promise<boolean> {
        if (!email) return false;
        const crmUser = await crmUserRepository.findByEmailOrAppEmail(email);
        return !!crmUser;
    }

    async resolveFullResume(castId: string): Promise<ResolvedResume> {
        const [crmResult, regularResult] = await Promise.all([
            crmJobRequestRepository.findOne({ id: castId } as any),
            jobRequestRepository.findOne({ id: castId } as any),
        ]);

        const isCrmRecord = !!crmResult;
        const record = crmResult || regularResult;

        if (!record) {
            throw new NotFoundError('Resume', castId);
        }

        const userId: string | null = (record as any).user_id || null;
        const email: string | null = (record as any).email || (record as any).candidate_email || null;
        const jobTitle: string | null = (record as any).job_title || null;
        const rawResumeUrl: string | null = (record as any).resume_url || (record as any).resume_path || null;

        const resumeUrl = storageService.resolvePublicUrl(
            rawResumeUrl,
            storageService.getResumeBucket(isCrmRecord),
        );

        let videoUrl: string | null = null;

        const crmVideos = await crmRecordingRepository.findByJobRequestId(castId);
        if (crmVideos.length > 0 && crmVideos[0].video_url) {
            videoUrl = storageService.resolvePublicUrl(
                crmVideos[0].video_url,
                storageService.getRecordingBucket(true),
            );
        } else {
            const regVideos = await recordingRepository.findByJobRequestId(castId);
            if (regVideos.length > 0 && regVideos[0].storage_path) {
                videoUrl = storageService.resolvePublicUrl(
                    regVideos[0].storage_path,
                    storageService.getRecordingBucket(false),
                );
            }
        }

        let candidateName: string | null = null;
        let portfolioUrl: string | null = null;

        if (userId) {
            const [profile, portfolio] = await Promise.all([
                profileRepository.findById(userId),
                portfolioRepository.findByUserId(userId),
            ]);
            candidateName = profile?.full_name || profile?.first_name || null;
            portfolioUrl = portfolio?.url || null;
        } else if (email) {
            const profile = await profileRepository.findByEmail(email);
            candidateName = profile?.full_name || profile?.first_name || null;
        }

        const tier = await subscriptionService.getTier(castId);

        return {
            castId,
            jobTitle,
            email,
            candidateName,
            resumeUrl,
            videoUrl,
            portfolioUrl,
            tier,
            userId,
        };
    }

    /**
     * Creates a new job request. CRM status is determined server-side
     * by querying digital_resume_by_crm.
     *
     * For non-CRM users: ensures a profile row exists (original Step1 behavior
     * created one with plan_tier: 'free', plan_status: 'active', credits_remaining: 3).
     */
    async createJobRequest(params: CreateJobRequestParams): Promise<{ id: string }> {
        const { userId, email, jobTitle, jobDescription } = params;
        const isCRM = await this.resolveCrmStatus(email);

        if (isCRM) {
            if (!email) throw new Error('Email is required for CRM job requests');
            const data = await crmJobRequestRepository.create({
                email,
                user_id: userId,
                job_title: jobTitle,
                job_description: jobDescription,
                application_status: 'draft',
            });
            return { id: data.id };
        } else {
            // Ensure profile row exists (original Step1 behavior)
            const existingProfile = await profileRepository.findById(userId);
            if (!existingProfile) {
                await profileRepository.create({
                    id: userId,
                    email: email || '',
                    credits_remaining: 3,
                } as any);
            }

            const data = await jobRequestRepository.create({
                user_id: userId,
                email: email || '',
                job_title: jobTitle,
                job_description: jobDescription,
                status: 'draft',
            });
            return { id: data.id };
        }
    }

    /**
     * Uploads a resume file to storage and updates the existing job request.
     * Verifies job request ownership before updating.
     */
    async uploadResume(params: UploadResumeParams): Promise<{ resumeUrl: string; fileName: string }> {
        const { userId, email, fileBuffer, originalName, mimeType, jobRequestId } = params;
        const isCRM = await this.resolveCrmStatus(email);

        // Verify ownership: the job request must belong to this user
        if (isCRM) {
            const existing = await crmJobRequestRepository.findOne({ id: jobRequestId } as any);
            if (!existing) throw new Error('Job request not found');
            // For CRM records, verify user_id matches
            if ((existing as any).user_id && (existing as any).user_id !== userId) {
                throw new Error('Unauthorized: job request does not belong to this user');
            }
        } else {
            const existing = await jobRequestRepository.findOne({ id: jobRequestId } as any);
            if (!existing) throw new Error('Job request not found');
            if ((existing as any).user_id && (existing as any).user_id !== userId) {
                throw new Error('Unauthorized: job request does not belong to this user');
            }
        }

        const bucket = isCRM ? 'CRM_users_resumes' : 'resumes';
        const fileExt = originalName.split('.').pop()?.toLowerCase() || 'pdf';
        const storagePath = isCRM
            ? `${email}/${jobRequestId}_${Date.now()}.${fileExt}`
            : `${userId}/${jobRequestId}_${Date.now()}.${fileExt}`;

        const uploadedPath = await storageService.uploadFile(bucket, storagePath, fileBuffer, mimeType);
        if (!uploadedPath) throw new Error('Failed to upload file');

        const resumeUrl = storageService.resolvePublicUrl(uploadedPath, bucket);
        if (!resumeUrl) throw new Error('Failed to resolve public URL');

        if (isCRM) {
            await crmJobRequestRepository.update(
                { id: jobRequestId } as any,
                { resume_url: resumeUrl, application_status: 'ready' },
            );
        } else {
            await jobRequestRepository.update(
                { id: jobRequestId } as any,
                { resume_path: resumeUrl, status: 'ready' },
            );
        }

        return {
            resumeUrl,
            fileName: originalName,
        };
    }

    async getHistory(email: string, isCRM: boolean): Promise<any[]> {
        let jobs: any[];
        if (isCRM) {
            jobs = await crmJobRequestRepository.findMany(
                { email } as any,
                { orderBy: 'created_at', orderDirection: 'desc' },
            );
        } else {
            jobs = await jobRequestRepository.findMany(
                { email } as any,
                { orderBy: 'created_at', orderDirection: 'desc' },
            );
        }

        const enriched = await Promise.all(jobs.map(async (job: any) => {
            const recs = isCRM
                ? await crmRecordingRepository.findByJobRequestId(job.id)
                : await recordingRepository.findByJobRequestId(job.id);
            const rec = recs[0];
            let videoUrl: string | null = null;
            if (rec) {
                const raw = rec.video_url || rec.storage_path;
                if (raw) {
                    videoUrl = storageService.resolvePublicUrl(
                        raw,
                        storageService.getRecordingBucket(isCRM),
                    );
                }
            }
            return { ...job, video_url: videoUrl };
        }));

        return enriched;
    }

    async updateJobDescription(userId: string, email: string, jobRequestId: string, jobDescription: string): Promise<void> {
        const isCRM = await this.resolveCrmStatus(email);

        // Verify ownership
        if (isCRM) {
            const existing = await crmJobRequestRepository.findOne({ id: jobRequestId } as any);
            if (!existing) throw new Error('Job request not found');
            if ((existing as any).user_id && (existing as any).user_id !== userId) {
                throw new Error('Unauthorized: job request does not belong to this user');
            }
            await crmJobRequestRepository.update(
                { id: jobRequestId } as any,
                { job_description: jobDescription },
            );
        } else {
            const existing = await jobRequestRepository.findOne({ id: jobRequestId } as any);
            if (!existing) throw new Error('Job request not found');
            if ((existing as any).user_id && (existing as any).user_id !== userId) {
                throw new Error('Unauthorized: job request does not belong to this user');
            }
            await jobRequestRepository.update(
                { id: jobRequestId } as any,
                { job_description: jobDescription },
            );
        }
    }
}

export const resumeService = new ResumeService();