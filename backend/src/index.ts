/**
 * Application Entry Point
 *
 * Bootstraps the Express server and starts listening.
 */
import { createApp } from './app.js';
import { environment } from './config/environment.js';
import { logger } from './logger/index.js';

async function main(): Promise<void> {
    const app = createApp();

    app.listen(environment.port, () => {
        logger.info(
            { port: environment.port, nodeEnv: environment.nodeEnv },
            `Digital Resume API server started`,
        );
    });
}

main().catch((err) => {
    logger.error({ err }, 'Failed to start server');
    process.exit(1);
});