import { z } from 'zod';

export const getResumeParamsSchema = z.object({
    castId: z.string().min(1),
});