/**
 * Career Identity Types
 * ------------------------------------------------------------------
 * Foundation-only models for the Tier 2 "Career Identity" premium profile.
 * Data is stored in `profiles.career_identity_data` as a JSONB column.
 *
 * Content is stored as a single flexible `content` jsonb blob
 * (CareerIdentityContent below) rather than one table per section. This
 * keeps the foundation simple; it can be normalized into dedicated tables
 * later without changing the public shape of `CareerIdentityProfile`.
 *
 * IMPORTANT: `content` only holds data that has nowhere else to live
 * (about, education, experience, projects, skills, certifications,
 * achievements, contact overrides). Data that already exists elsewhere in
 * the project — candidate name, resume URL, video URL, portfolio URL —
 * is NEVER copied in here. It's resolved live at request time; see
 * `CareerIdentityDerivedData` below.
 */

export type CareerIdentityProfileStatus = "draft" | "published";

/**
 * Managed-service workflow lifecycle for Career Identity.
 * Separate from publication status — a profile can be "published"
 * while also being in any workflow state.
 */
export type CareerIdentityWorkflowStatus =
    | "not_submitted"
    | "submitted"
    | "in_progress"
    | "ready_for_review"
    | "changes_requested";

export interface CareerIdentityProfile {
    id: string;
    resumeId: string;
    userId: string | null;
    /** Key of the assigned theme — see themes/themeRegistry.ts */
    themeId: string;
    status: CareerIdentityProfileStatus;
    content: CareerIdentityContent;
    createdAt: string;
    updatedAt: string;
}

export interface CareerIdentityContent {
    hero?: HeroContent;
    about?: string;
    education?: EducationItem[];
    experience?: ExperienceItem[];
    projects?: ProjectItem[];
    skills?: SkillItem[];
    certifications?: CertificationItem[];
    achievements?: AchievementItem[];
    contact?: ContactInfo;
}

export interface HeroContent {
    fullName?: string;
    headline?: string;
    tagline?: string;
    profileImageUrl?: string;
    /** Recruiter-facing credibility badges/chips shown under the name. */
    verified?: boolean;
    openToWork?: boolean;
    openToRelocate?: boolean;
    immediateJoiner?: boolean;
    remote?: boolean;
    /** Free-form badges beyond the standard set above, shown after them. */
    badges?: string[];
}

export interface EducationItem {
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
}

export interface ExperienceItem {
    id: string;
    company: string;
    title: string;
    startDate?: string;
    endDate?: string;
    description?: string;
}

export interface ProjectItem {
    id: string;
    name: string;
    description?: string;
    url?: string;
}

export interface SkillItem {
    id: string;
    name: string;
    level?: "beginner" | "intermediate" | "advanced" | "expert";
}

export interface CertificationItem {
    id: string;
    name: string;
    issuer?: string;
    issuedDate?: string;
    url?: string;
}

export interface AchievementItem {
    id: string;
    title: string;
    description?: string;
    date?: string;
}

export interface ContactInfo {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
}

/**
 * Data that already exists elsewhere in the project (job_requests /
 * crm_job_requests, profiles, portfolio_settings, recordings /
 * crm_recordings) and is resolved live for a Career Identity profile
 * instead of being duplicated. This keeps a single source of truth —
 * e.g. if someone updates their portfolio link in portfolio_settings,
 * Career Identity reflects it immediately with no sync step required.
 */
export interface CareerIdentityDerivedData {
    candidateName: string | null;
    email: string | null;
    jobTitle: string | null;
    resumeUrl: string | null;
    videoUrl: string | null;
    portfolioUrl: string | null;
}

/** Shape returned by the `career-identity-profile` edge function (GET and PATCH). */
export interface CareerIdentityProfileResponse {
    tier: "digital_resume" | "career_identity";
    profile: CareerIdentityProfile | null;
    /** null whenever profile is null (i.e. tier isn't career_identity yet) */
    derived: CareerIdentityDerivedData | null;
}

/**
 * Payload accepted by the PATCH endpoint. `content` is shallow-merged
 * per top-level section key (e.g. sending { content: { about: "..." } }
 * only touches `about` and leaves education/experience/etc. untouched) —
 * so future section editors can save independently of one another.
 */
export interface CareerIdentityUpdatePayload {
    content?: Partial<CareerIdentityContent>;
    status?: CareerIdentityProfileStatus;
}