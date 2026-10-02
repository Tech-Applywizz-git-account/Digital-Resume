/**
 * Logger
 *
 * Structured JSON logging using Pino.
 * In development, logs are pretty-printed to the console.
 * In production, logs are raw JSON for log aggregators.
 */
import pino from 'pino';
import { environment } from '../config/environment.js';

const transport = environment.nodeEnv !== 'production'
    ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
        },
    }
    : undefined;

export const logger = pino({
    level: environment.logLevel,
    transport,
    base: {
        service: 'digital-resume-api',
    },
    serializers: {
        req: (req) => ({
            method: req.method,
            url: req.url,
            requestId: req.requestId,
        }),
        res: (res) => ({
            statusCode: res.statusCode,
        }),
        err: pino.stdSerializers.err,
    },
});