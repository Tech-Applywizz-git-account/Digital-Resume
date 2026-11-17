import { getDatabase } from '../../config/database.js';

async function readRows(table: string, columns: string, key = 'id') {
    const db = getDatabase();
    const rows: Record<string, any>[] = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
        const { data, error } = await db.from(table).select(columns)
            .order(key).range(offset, offset + size - 1);
        if (error) throw error;
        const page = (data ?? []) as unknown as Record<string, any>[];
        rows.push(...page);
        if (page.length < size) return rows;
    }
}

const normalizeEmail = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const hasText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

export async function getBusinessOverview() {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 30 * 86400000);
    const [profiles, admins, crmUsers, jobs, crmJobs, recordings, crmRecordings, projects, submissions] = await Promise.all([
        readRows('profiles', 'id,email,tier,credits_remaining,career_identity_data,tier_change_logs'),
        readRows('crm_admins', 'email', 'email'),
        readRows('digital_resume_by_crm', 'email,company_application_email,user_id,credits_remaining', 'email'),
        readRows('job_requests', 'id,user_id,status,resume_path'),
        readRows('crm_job_requests', 'id,user_id,email,application_status,resume_url'),
        readRows('recordings', 'id,job_request_id,storage_path'),
        readRows('crm_recordings', 'id,job_request_id,video_url'),
        readRows('career_identity_projects', 'id,user_id,pending_submission_id,published_submission_id,clarity_settings'),
        readRows('career_identity_submissions', 'id,project_id,submitted_at,published_at', 'id'),
    ]);

    const adminEmails = new Set(admins.map(row => normalizeEmail(row.email)));
    const adminIds = new Set(profiles.filter(row => adminEmails.has(normalizeEmail(row.email))).map(row => row.id));
    const clients = new Map(profiles.filter(row => !adminIds.has(row.id)).map(row => [row.id, row]));
    const ownerByEmail = new Map<string, string | null>();
    const rememberOwner = (address: unknown, id: string) => {
        const email = normalizeEmail(address);
        if (!email) return;
        const known = ownerByEmail.get(email);
        ownerByEmail.set(email, known === undefined || known === id ? id : null);
    };
    for (const profile of profiles) rememberOwner(profile.email, profile.id);
    const crmByOwner = new Map<string, Record<string, any>>();
    for (const row of crmUsers) {
        if (!row.user_id || adminIds.has(row.user_id) ||
            [row.email, row.company_application_email].some(email => adminEmails.has(normalizeEmail(email)))) continue;
        if (!clients.has(row.user_id)) clients.set(row.user_id, { id: row.user_id, tier: 'digital_resume' });
        crmByOwner.set(row.user_id, row);
        rememberOwner(row.email, row.user_id);
        rememberOwner(row.company_application_email, row.user_id);
    }

    const regularVideos = new Set(recordings.filter(row => hasText(row.storage_path)).map(row => row.job_request_id));
    const crmVideos = new Set(crmRecordings.filter(row => hasText(row.video_url)).map(row => row.job_request_id));
    const activation = new Map<string, number>();
    const ownersWithCasts = new Set<string>();
    function recordActivation(owner: string | null, status: unknown, pdf: unknown, video: boolean) {
        if (!owner || !clients.has(owner)) return;
        const state = status === 'recorded' && hasText(pdf) && video ? 2 : hasText(pdf) || video ? 1 : 0;
        activation.set(owner, Math.max(state, activation.get(owner) ?? 0));
    }
    for (const job of jobs) {
        if (job.user_id) ownersWithCasts.add(job.user_id);
        recordActivation(job.user_id, job.status, job.resume_path, regularVideos.has(job.id));
    }
    for (const job of crmJobs) {
        if (job.user_id) ownersWithCasts.add(job.user_id);
        recordActivation(job.user_id || ownerByEmail.get(normalizeEmail(job.email)) || null,
            job.application_status, job.resume_url, crmVideos.has(job.id));
    }

    const projectByOwner = new Map(projects.map(project => [project.user_id, project]));
    const firstPublishedByProject = new Map<string, Record<string, any>>();
    for (const submission of submissions) {
        if (!submission.published_at) continue;
        const previous = firstPublishedByProject.get(submission.project_id);
        if (!previous || Date.parse(submission.published_at) < Date.parse(previous.published_at)) {
            firstPublishedByProject.set(submission.project_id, submission);
        }
    }

    const totals = { total: clients.size, digitalResume: 0, careerIdentity: 0, clarityActive: 0 };
    const digitalResume = { noResume: 0, incomplete: 0, completed: 0 };
    const delivery = { notSubmitted: 0, awaitingPublication: 0, published: 0, pendingUpdates: 0 };
    const credits = { remaining: 0, accountsWithBalance: 0 };
    const activity = { upgrades: 0, firstPublications: 0, medianPublishHours: null as number | null, timedPublications: 0 };
    const durations: number[] = [];
    const inPeriod = (date: string) => Date.parse(date) >= periodStart.getTime() && Date.parse(date) <= now.getTime();

    for (const [id, profile] of clients) {
        const balance = crmByOwner.get(id)?.credits_remaining ?? profile.credits_remaining;
        if (typeof balance === 'number' && Number.isFinite(balance) && balance >= 0) {
            credits.accountsWithBalance++;
            credits.remaining += balance;
        }
        if (Array.isArray(profile.tier_change_logs)) {
            activity.upgrades += profile.tier_change_logs.filter((entry: any) =>
                entry?.operation === 'tier_switch' && entry.from_tier === 'digital_resume' &&
                entry.to_tier === 'career_identity' && inPeriod(entry.created_at)).length;
        }
        const project = projectByOwner.get(id);
        const legacy = profile.career_identity_data;
        const first = project && firstPublishedByProject.get(project.id);
        if (first && legacy?.status !== 'published' && inPeriod(first.published_at)) {
            activity.firstPublications++;
            const hours = (Date.parse(first.published_at) - Date.parse(first.submitted_at)) / 3600000;
            if (Number.isFinite(hours) && hours >= 0) durations.push(hours);
        }
        if (profile.tier !== 'career_identity') {
            totals.digitalResume++;
            const state = activation.get(id) ?? 0;
            if (state === 2) digitalResume.completed++;
            else if (state === 1) digitalResume.incomplete++;
            else digitalResume.noResume++;
            continue;
        }

        totals.careerIdentity++;
        const published = !!project?.published_submission_id || (legacy?.status === 'published' && ownersWithCasts.has(id));
        const pending = !!project?.pending_submission_id;
        if (published) {
            delivery.published++;
            if (pending) delivery.pendingUpdates++;
            const clarity = project?.clarity_settings ?? legacy?.clarity;
            if (clarity?.status === 'active' && clarity?.clientConsent?.accepted === true && hasText(clarity?.projectId)) {
                totals.clarityActive++;
            }
        } else if (pending || (!project && ['submitted', 'in_progress', 'ready_for_review', 'changes_requested'].includes(legacy?.workflowStatus))) {
            delivery.awaitingPublication++;
        } else {
            delivery.notSubmitted++;
        }
    }
    durations.sort((a, b) => a - b);
    activity.timedPublications = durations.length;
    if (durations.length) {
        const middle = Math.floor(durations.length / 2);
        activity.medianPublishHours = durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
    }
    return { totals, digitalResume, delivery, activity, credits, calculatedAt: now.toISOString() };
}
