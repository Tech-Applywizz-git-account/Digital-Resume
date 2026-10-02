import { z } from 'zod';

export const createAdminSchema = z.object({
    email: z.string().email().transform(e => e.toLowerCase().trim()),
    password: z.string().min(6).max(128),
});