import { z } from 'zod';

export const upsertPortfolioSchema = z.object({
    url: z.string().url().or(z.literal('')),
    user_id: z.string().uuid().optional(),
    email: z.string().email().optional(),
});