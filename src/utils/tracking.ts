/**
 * Tracking Utility for Digital Resume
 * Fires events to BOTH Edge Functions simultaneously:
 *   1. track-resume-click  → resume_click_tracking table (legacy, per-click rows)
 *   2. track-resume-session → resume_sessions table     (session-level analytics)
 */

const SESSION_KEY = 'dr_session_id';
const START_TIME_KEY = 'dr_session_start';

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

/** Initialize or retrieve a persistent session ID for this browser tab */
export const getSessionId = (): string => {
    let sessionId = sessionStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        sessionStorage.setItem(SESSION_KEY, sessionId);
        sessionStorage.setItem(START_TIME_KEY, Date.now().toString());
    }
    return sessionId;
};

/** Get session duration in seconds since page first loaded */
export const getSessionDuration = (): number => {
    const startTime = sessionStorage.getItem(START_TIME_KEY);
    if (!startTime) return 0;
    return Math.max(0, Math.floor((Date.now() - parseInt(startTime)) / 1000));
};

/** Get UTM parameters and referrer from the current URL */
export const getTrackingMetadata = () => {
    const params = new URLSearchParams(window.location.search);
    return {
        referrer: document.referrer || 'direct',
        utm_source: params.get('utm_source') || undefined,
        utm_campaign: params.get('utm_campaign') || undefined,
        source: params.get('source') || undefined,
    };
};

// ---------------------------------------------------------------------------
// Internal fire-and-forget fetch helper
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const fireAndForget = (url: string, body: unknown, keepalive = false) => {
    fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': ANON_KEY,
        },
        body: JSON.stringify(body),
        keepalive,
    }).catch(err => console.error(`[Tracking] fetch error → ${url}`, err));
};

// ---------------------------------------------------------------------------
// Core tracking function — fires BOTH edge functions in parallel
// ---------------------------------------------------------------------------

export const trackEvent = (
    eventType: 'page_load' | 'play_intro' | 'lets_talk' | 'pdf_download' | 'portfolio_click' | 'session_end',
    resumeId: string,
    additionalData: Record<string, unknown> = {}
): void => {
    const sessionId = getSessionId();
    const metadata = getTrackingMetadata();
    const isSessionEnd = eventType === 'session_end';

    // ── 1. track-resume-session (new, session-level analytics) ──────────────
    const sessionPayload: Record<string, unknown> = {
        resume_id: resumeId,
        session_id: sessionId,
        event_type: eventType,
    };
    // duration_seconds only needed for session_end
    if (isSessionEnd && typeof additionalData.duration_seconds === 'number') {
        sessionPayload.duration_seconds = additionalData.duration_seconds;
    }

    fireAndForget(
        `${SUPABASE_URL}/functions/v1/track-resume-session`,
        sessionPayload,
        isSessionEnd   // keepalive for tab-close events
    );

    // ── 2. Google Analytics (if available) ──────────────────────────────────
    if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', eventType, {
            resume_id: resumeId,
            session_id: sessionId,
            ...additionalData,
        });
    }
};

// ---------------------------------------------------------------------------
// Session-end helper (called on beforeunload)
// ---------------------------------------------------------------------------

export const trackSessionEnd = (resumeId: string | null): void => {
    if (!resumeId) return;
    trackEvent('session_end', resumeId, { duration_seconds: getSessionDuration() });
};
