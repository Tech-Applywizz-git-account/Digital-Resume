import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * career-identity-profile
 * ---------------------------------------------------------------------------
 * GET   ?resume_id=<castId>&user_id=<optional>
 * PATCH  body: { resume_id, user_id?, content?, status? }
 *
 * GET:
 *   1. Resolves the subscription tier for this resume from profiles.tier.
 *   2. If tier is not "career_identity", returns { tier, profile: null,
 *      derived: null } — nothing further to build against yet.
 *   3. If tier is "career_identity", reads profiles.career_identity_data
 *      for the user who owns the castId. If no data exists, creates a
 *      default entry with theme assignment.
 *   4. Resolves "derived" data (candidate name, resume URL, video URL,
 *      portfolio URL, job title) LIVE from the same tables the existing
 *      Digital Resume flow already uses.
 *
 * PATCH:
 *   Updates the Career Identity–only fields stored in
 *   profiles.career_identity_data.content (about, education, experience,
 *   projects, skills, certifications, achievements, contact overrides).
 *   `content` is shallow-merged per top-level key so a future section
 *   editor can save its own section without touching others.
 * ---------------------------------------------------------------------------
 */

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

function toProfileDTO(row: Record<string, unknown>, castId: string, userId: string) {
    return {
        id: userId,
        resumeId: castId,
        userId: userId,
        themeId: row.themeId ?? null,
        status: row.status ?? 'draft',
        workflowStatus: row.workflowStatus ?? 'not_submitted',
        content: row.content ?? {},
        createdAt: row.createdAt ?? null,
        updatedAt: row.updatedAt ?? null,
    };
}

/**
 * Builds a public storage URL for a stored path if it isn't already a full
 * URL.
 */
function resolveStorageUrl(
    supabase: SupabaseClient,
    path: string | null | undefined,
    bucket: string
): string | null {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    try {
        return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl ?? null;
    } catch {
        return null;
    }
}

interface DerivedData {
    candidateName: string | null;
    email: string | null;
    jobTitle: string | null;
    resumeUrl: string | null;
    videoUrl: string | null;
    portfolioUrl: string | null;
}

/**
 * Resolves data that already exists elsewhere in the project for a given
 * resumeId (castId).
 */
async function resolveDerivedData(
    supabase: SupabaseClient,
    resumeId: string
): Promise<DerivedData> {
    const [crmResult, regularResult] = await Promise.all([
        supabase.from("crm_job_requests").select("*").eq("id", resumeId).maybeSingle(),
        supabase.from("job_requests").select("*").eq("id", resumeId).maybeSingle(),
    ]);

    const isCrmRecord = !!crmResult.data;
    const data: Record<string, any> | null = crmResult.data || regularResult.data;

    const derived: DerivedData = {
        candidateName: null,
        email: null,
        jobTitle: null,
        resumeUrl: null,
        videoUrl: null,
        portfolioUrl: null,
    };

    if (!data) return derived;

    derived.jobTitle = data.job_title ?? null;
    derived.email = data.email ?? data.candidate_email ?? null;

    const rawResumeUrl = data.resume_url ?? data.resume_path ?? null;
    derived.resumeUrl = resolveStorageUrl(
        supabase,
        rawResumeUrl,
        isCrmRecord ? "CRM_users_resumes" : "resumes"
    );

    const userId: string | null = data.user_id ?? null;

    // Video: check CRM recordings first, then regular recordings
    const { data: crmVideo } = await supabase
        .from("crm_recordings")
        .select("video_url")
        .eq("job_request_id", resumeId)
        .order("created_at", { ascending: false })
        .limit(1);

    if (crmVideo && crmVideo.length > 0 && crmVideo[0].video_url) {
        derived.videoUrl = resolveStorageUrl(supabase, crmVideo[0].video_url, "CRM_users_recordings");
    } else {
        const { data: regVideo } = await supabase
            .from("recordings")
            .select("storage_path")
            .eq("job_request_id", resumeId)
            .order("created_at", { ascending: false })
            .limit(1);

        if (regVideo && regVideo.length > 0 && regVideo[0].storage_path) {
            derived.videoUrl = resolveStorageUrl(supabase, regVideo[0].storage_path, "recordings");
        }
    }

    // Candidate name + portfolio: both keyed off user_id in existing tables.
    if (userId) {
        const [profileRes, portfolioRes] = await Promise.all([
            supabase.from("profiles").select("first_name, full_name").eq("id", userId).maybeSingle(),
            supabase.from("portfolio_settings").select("url").eq("user_id", userId).maybeSingle(),
        ]);

        if (profileRes.data) {
            derived.candidateName = profileRes.data.full_name || profileRes.data.first_name || null;
        }
        if (portfolioRes.data?.url) {
            derived.portfolioUrl = portfolioRes.data.url;
        }
    } else if (derived.email) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, full_name")
            .eq("email", derived.email)
            .maybeSingle();
        if (profile) {
            derived.candidateName = profile.full_name || profile.first_name || null;
        }
    }

    return derived;
}

/**
 * Resolves the effective tier for a resume by looking up the resume owner's
 * user_id via crm_job_requests or job_requests, then reading profiles.tier.
 */
async function resolveTierFromProfile(
    supabase: SupabaseClient,
    resumeId: string
): Promise<string> {
    const [crmJob, regJob] = await Promise.all([
        supabase.from("crm_job_requests").select("user_id").eq("id", resumeId).maybeSingle(),
        supabase.from("job_requests").select("user_id").eq("id", resumeId).maybeSingle(),
    ]);

    const record = crmJob.data || regJob.data;
    if (!record?.user_id) {
        return "digital_resume";
    }

    const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", record.user_id)
        .maybeSingle();

    return profile?.tier === "career_identity" ? "career_identity" : "digital_resume";
}

/**
 * Resolves the user_id for a given castId (resume ID).
 */
async function resolveUserIdFromCastId(
    supabase: SupabaseClient,
    castId: string
): Promise<string | null> {
    const [crmJob, regJob] = await Promise.all([
        supabase.from("crm_job_requests").select("user_id").eq("id", castId).maybeSingle(),
        supabase.from("job_requests").select("user_id").eq("id", castId).maybeSingle(),
    ]);

    const record = crmJob.data || regJob.data;
    return record?.user_id ?? null;
}

/**
 * Assigns a theme using round-robin based on the existing sequence.
 * Falls back to random if the sequence RPC is unavailable.
 */
async function assignTheme(supabase: SupabaseClient): Promise<string> {
    const { data: themes } = await supabase
        .from("career_identity_themes")
        .select("id")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("id", { ascending: true });

    if (!themes || themes.length === 0) {
        // Development-safe fallback: return the default theme.
        // Production databases should have seed data in career_identity_themes.
        return "aurora";
    }

    // Try to use the sequence for atomic round-robin
    const { data: seqResult } = await supabase.rpc("nextval", {
        sequence_name: "public.career_identity_theme_assignment_seq",
    } as any);

    const ticket = seqResult
        ? Number(seqResult)
        : Math.floor(Math.random() * 1000000);

    const targetOffset = (ticket - 1) % themes.length;
    return themes[targetOffset].id;
}

/**
 * Reads career_identity_data from profiles for the user who owns the castId.
 */
async function readCareerIdentityData(
    supabase: SupabaseClient,
    castId: string
): Promise<{ userId: string | null; ciData: Record<string, any> | null }> {
    const userId = await resolveUserIdFromCastId(supabase, castId);
    if (!userId) return { userId: null, ciData: null };

    const { data: profile } = await supabase
        .from("profiles")
        .select("career_identity_data")
        .eq("id", userId)
        .maybeSingle();

    return { userId, ciData: profile?.career_identity_data ?? null };
}

async function handleGet(supabase: SupabaseClient, req: Request): Promise<Response> {
    const url = new URL(req.url);
    const resumeId = url.searchParams.get("resume_id")?.trim();
    const userId = url.searchParams.get("user_id")?.trim() || null;

    if (!resumeId) {
        return jsonResponse({ error: "resume_id is required" }, 400);
    }

    // 1. Resolve tier from profiles.tier
    const tier = await resolveTierFromProfile(supabase, resumeId);

    if (tier !== "career_identity") {
        return jsonResponse({ tier, profile: null, derived: null });
    }

    // 2. Read career_identity_data from profiles
    const { userId: ownerId, ciData } = await readCareerIdentityData(supabase, resumeId);

    let profileRow = ciData;
    const effectiveUserId = ownerId || userId;

    // 3. Auto-create default Career Identity data if none exists
    if (!profileRow) {
        const now = new Date().toISOString();
        const themeId = await assignTheme(supabase);
        profileRow = {
            themeId,
            status: "draft",
            content: {},
            createdAt: now,
            updatedAt: now,
        };

        // Write to profiles table
        if (effectiveUserId) {
            const { error: updateError } = await supabase
                .from("profiles")
                .update({ career_identity_data: profileRow })
                .eq("id", effectiveUserId);

            if (updateError) throw updateError;
        }
    }

    // 4. Resolve derived data live from existing tables
    const derived = await resolveDerivedData(supabase, resumeId);

    return jsonResponse({
        tier,
        profile: effectiveUserId ? toProfileDTO(profileRow, resumeId, effectiveUserId) : null,
        derived,
    });
}

async function handlePatch(supabase: SupabaseClient, req: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try {
        body = await req.json();
    } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const resumeId = typeof body.resume_id === "string" ? body.resume_id.trim() : "";
    const userId = typeof body.user_id === "string" ? body.user_id.trim() : null;
    const contentUpdates = (body.content ?? null) as Record<string, unknown> | null;
    const statusUpdate = typeof body.status === "string" ? body.status : undefined;
    const workflowStatusUpdate = typeof body.workflowStatus === "string" ? body.workflowStatus : undefined;

    if (!resumeId) {
        return jsonResponse({ error: "resume_id is required" }, 400);
    }

    if (statusUpdate && statusUpdate !== "draft" && statusUpdate !== "published") {
        return jsonResponse({ error: "status must be 'draft' or 'published'" }, 400);
    }

    if (workflowStatusUpdate && !["not_submitted", "submitted", "in_progress", "ready_for_review", "changes_requested"].includes(workflowStatusUpdate)) {
        return jsonResponse({ error: "Invalid workflowStatus value" }, 400);
    }

    // Read career_identity_data from profiles
    const { userId: ownerId, ciData: existing } = await readCareerIdentityData(supabase, resumeId);

    if (!existing) {
        return jsonResponse({ error: "Career Identity profile not found. Create one first via GET." }, 404);
    }

    // Ownership check: if the profile already has an owner and the caller
    // supplies a different one, reject.
    if (ownerId && userId && ownerId !== userId) {
        return jsonResponse({ error: "Not authorized to update this profile" }, 403);
    }

    const effectiveUserId = ownerId || userId;
    if (!effectiveUserId) {
        return jsonResponse({ error: "Cannot update profile: no user_id resolved" }, 400);
    }

    const existingContent = existing.content ?? {};
    const mergedContent = contentUpdates
        ? { ...existingContent, ...contentUpdates }
        : existingContent;

    const now = new Date().toISOString();
    const updatedCiData = {
        ...existing,
        content: mergedContent,
        status: statusUpdate ?? existing.status,
        workflowStatus: workflowStatusUpdate ?? existing.workflowStatus,
        updatedAt: now,
    };

    // Update profiles.career_identity_data
    const { error: updateError } = await supabase
        .from("profiles")
        .update({ career_identity_data: updatedCiData })
        .eq("id", effectiveUserId);

    if (updateError) throw updateError;

    // Re-resolve tier and derived data for the response
    const tier = await resolveTierFromProfile(supabase, resumeId);
    const derived = await resolveDerivedData(supabase, resumeId);

    return jsonResponse({
        tier,
        profile: toProfileDTO(updatedCiData, resumeId, effectiveUserId),
        derived,
    });
}

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
        return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
    });

    try {
        if (req.method === "GET") {
            return await handleGet(supabase, req);
        }
        if (req.method === "PATCH") {
            return await handlePatch(supabase, req);
        }
        return jsonResponse({ error: "Method not allowed" }, 405);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Internal server error";
        console.error("[career-identity-profile] Function error:", err);
        return jsonResponse({ error: message }, 500);
    }
});