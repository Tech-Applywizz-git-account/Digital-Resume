import { z } from 'zod';

export const switchTierSchema = z.object({
    email: z.string().email().transform((e) => e.toLowerCase().trim()).optional(),
    userId: z.string().uuid().optional(),
    toTier: z.enum(['digital_resume', 'career_identity']),
    reason: z.string().max(500).optional(),
}).refine((data) => !!data.email || !!data.userId, {
    message: 'email or userId is required',
});

const optionalEmail = z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.string().email().transform((e) => e.toLowerCase().trim()).optional(),
);

const optionalUuid = z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.string().uuid().optional(),
);

export const tierLogsQuerySchema = z.object({
    email: optionalEmail,
    userId: optionalUuid,
});
