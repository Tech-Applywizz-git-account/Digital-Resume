import { getDatabase } from '../../config/database.js';
import { logger } from '../../logger/index.js';

export interface TrackEventPayload {
    resumeId: string;
    sessionId: string;
    eventType: string;
    metadata?: Record<string, unknown>;
}

export class TrackingService {
    async trackEvent(payload: TrackEventPayload): Promise<void> {
        try {
            const db = getDatabase();
            await db.from('resume_events').insert({
                resume_id: payload.resumeId,
                session_id: payload.sessionId,
                event_type: payload.eventType,
                metadata: payload.metadata || {},
            });
        } catch (err) {
            logger.error({ err, payload }, 'Failed to track event');
        }
    }
}

export const trackingService = new TrackingService();