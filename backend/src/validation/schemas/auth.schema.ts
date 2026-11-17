import { z } from 'zod';

export const resolveEmailSchema = z.object({
    email: z.string().email().transform(e => e.toLowerCase().trim()),
});

export const sendOtpSchema = z.object({
    action: z.literal('send'),
    email: z.string().email().transform(e => e.toLowerCase().trim()),
});

export const verifyOtpSchema = z.object({
    action: z.literal('verify'),
    email: z.string().email().transform(e => e.toLowerCase().trim()),
    otp: z.string().length(6).regex(/^\d{6}$/),
});