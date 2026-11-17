import { z } from 'zod';

export const trackEventSchema = z.object({
    resumeId: z.string().min(1),
    sessionId: z.string().uuid(),
    eventType: z.enum(['page_load', 'play_intro', 'lets_talk', 'pdf_download', 'portfolio_click', 'session_end']),
    metadata: z.record(z.unknown()).optional(),
});

export const getAnalyticsParamsSchema = z.object({
    castId: z.string().min(1),
});