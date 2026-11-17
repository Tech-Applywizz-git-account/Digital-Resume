import { z } from 'zod';

export const createUserSchema = z.object({
    email: z.string().email().transform(e => e.toLowerCase().trim()),
});

export const updateCreditsSchema = z.object({
    email: z.string().email(),
    credits: z.number().int().min(0).max(9999),
});

export const replaceResumeSchema = z.object({
    email: z.string().email(),
});