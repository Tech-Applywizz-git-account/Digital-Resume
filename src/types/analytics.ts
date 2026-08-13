/**
 * Engagement Analytics Types (Tier 1 & Tier 2 — Profile Engagement Analytics)
 * ------------------------------------------------------------------
 * TYPES ONLY. No tracking/aggregation logic is implemented in this pass.
 *
 * Existing reusable foundation (already built, do not duplicate):
 *   - src/utils/tracking.ts              → fires page_load / play_intro / lets_talk /
 *                                           pdf_download / portfolio_click / session_end
 *   - supabase/functions/track-resume-session → writes to `resume_sessions` table
 *   - src/pages/ResumeAnalytics.tsx       → already computes totalViews, uniqueVisitors,
 *                                           avgDuration, pdfDownloads, videoPlays, chatOpens,
 *                                           portfolioClicks from `resume_sessions`
 *
 * What's still missing for the full spec (future work, not this pass):
 *   - QR Code scan event (new `qr_scanned` column/event type on resume_sessions)
 *   - Microsoft Clarity integration (heatmaps, click tracking, session recordings,
 *     scroll depth) — a separate script/config concern, not a data model
 */

export interface EngagementMetrics {
    totalProfileViews: number;
    uniqueVisitors: number;
    videoPlays: number;
    resumeDownloads: number;
    qrCodeScans: number;
    averageTimeOnResumeSeconds: number;
}