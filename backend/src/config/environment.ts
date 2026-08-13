/**
 * Environment Configuration
 *
 * Centralized typed access to environment variables.
 * Never reference process.env directly anywhere else.
 */
import 'dotenv/config';
export interface Environment {
    nodeEnv: string;
    port: number;
    logLevel: string;

    // Supabase
    supabaseUrl: string;
    supabaseServiceRoleKey: string;
    supabaseAnonKey: string;

    // CORS — comma-separated origins, e.g. https://app.vercel.app,http://localhost:5173
    corsOrigins: string[];

    // Rate Limiting
    rateLimitWindowMs: number;
    rateLimitMax: number;

    // Microsoft Graph (Email)
    tenantId: string;
    clientId: string;
    clientSecret: string;
    senderEmail: string;
}

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

function optionalEnv(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue;
}

function optionalEnvInt(key: string, defaultValue: number): number {
    const raw = process.env[key];
    if (raw === undefined || raw === '') return defaultValue;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

export const environment: Environment = {
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    port: optionalEnvInt('PORT', 4000),
    logLevel: optionalEnv('LOG_LEVEL', 'info'),

    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseServiceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseAnonKey: requireEnv('SUPABASE_ANON_KEY'),

    corsOrigins: optionalEnv(
        'CORS_ORIGIN',
        'http://localhost:5173,http://localhost:3000',
    )
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),

    rateLimitWindowMs: optionalEnvInt('RATE_LIMIT_WINDOW_MS', 60000),
    rateLimitMax: optionalEnvInt('RATE_LIMIT_MAX', 100),

    tenantId: optionalEnv('TENANT_ID', ''),
    clientId: optionalEnv('CLIENT_ID', ''),
    clientSecret: optionalEnv('CLIENT_SECRET', ''),
    senderEmail: optionalEnv('SENDER_EMAIL', ''),
};