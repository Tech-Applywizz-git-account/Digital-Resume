/**
 * Express Application Factory
 *
 * Creates and configures the Express app with all middleware.
 * Does NOT start listening — that's the responsibility of index.ts.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { environment } from './config/environment.js';

export function createApp(): express.Application {
    const app = express();

    // ── Global Middleware ──────────────────────────────────────────
    app.use(helmet());
    app.use(compression());
    app.use(cors({
        origin(origin, callback) {
            // Allow non-browser clients (no Origin) and configured frontends
            if (!origin || environment.corsOrigins.includes(origin) || environment.corsOrigins.includes('*')) {
                callback(null, true);
                return;
            }
            callback(null, false);
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
        exposedHeaders: ['X-Request-Id'],
        credentials: true,
    }));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // ── Request Tracking ───────────────────────────────────────────
    app.use(requestId);
    app.use(requestLogger);

    // ── Rate Limiting ──────────────────────────────────────────────
    app.use(rateLimit);

    // ── Health Check ───────────────────────────────────────────────
    app.get('/health', (_req, res) => {
        res.status(200).json({
            success: true,
            data: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            },
        });
    });

    // ── API Routes ─────────────────────────────────────────────────
    app.use('/api', apiRouter);

    // ── 404 Handler ────────────────────────────────────────────────
    app.use((_req, res) => {
        res.status(404).json({
            success: false,
            error: {
                code: 'NOT_FOUND',
                message: 'The requested resource was not found',
            },
        });
    });

    // ── Error Handler ──────────────────────────────────────────────
    app.use(errorHandler);

    return app;
}