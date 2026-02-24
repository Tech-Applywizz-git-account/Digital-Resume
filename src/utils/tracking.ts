/**
 * Tracking Utility for Digital Resume
 * Handles session management and event reporting to Supabase Edge Functions and Google Analytics
 */

const SESSION_KEY = 'dr_session_id';
const START_TIME_KEY = 'dr_session_start';

/**
 * Initialize or retrieve a session ID
 */
export const getSessionId = (): string => {
    let sessionId = localStorage.getItem(SESSION_KEY);
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem(SESSION_KEY, sessionId);
        localStorage.setItem(START_TIME_KEY, Date.now().toString());
    }
    return sessionId;
};

/**
 * Get session duration in seconds
 */
export const getSessionDuration = (): number => {
    const startTime = localStorage.getItem(START_TIME_KEY);
    if (!startTime) return 0;
    const duration = Math.floor((Date.now() - parseInt(startTime)) / 1000);
    return Math.max(0, duration);
};

/**
 * Get UTM parameters and referrer
 */
export const getTrackingMetadata = () => {
    const params = new URLSearchParams(window.location.search);
    return {
        referrer: document.referrer || 'direct',
        utm_source: params.get('utm_source') || undefined,
        utm_campaign: params.get('utm_campaign') || undefined,
    };
};

/**
 * Core tracking function
 */
export const trackEvent = async (
    eventType: 'page_load' | 'play_intro' | 'lets_talk' | 'pdf_download' | 'portfolio_click' | 'session_end',
    resumeId: string,
    additionalData: Record<string, any> = {}
) => {
    const sessionId = getSessionId();
    const metadata = getTrackingMetadata();

    // Combine base payload
    const payload = {
        resume_id: resumeId,
        event_type: eventType,
        session_id: sessionId,
        ...metadata,
        ...additionalData
    };

    // 1. Send to Supabase Edge Function
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-resume-click`;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    try {
        // High traffic optimization: using fetch (lighter than supabase client for this)
        fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
            },
            body: JSON.stringify(payload),
            // Use keepalive for session_end to ensure it completes during unload
            keepalive: eventType === 'session_end'
        }).catch(err => console.error('[Tracking] Edge Function Error:', err));

    } catch (err) {
        console.error('[Tracking] Post Error:', err);
    }

    // 2. Send to Google Analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', eventType, {
            resume_id: resumeId,
            session_id: sessionId,
            ...additionalData
        });
    }
};

/**
 * Specialized helper for session end
 */
export const trackSessionEnd = (resumeId: string | null) => {
    if (!resumeId) return;
    const duration = getSessionDuration();
    trackEvent('session_end', resumeId, { duration_seconds: duration });
};
