import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { resumesRouter } from './resumes.routes.js';
import profileRouter from './profile.routes.js';
import { walletRouter } from './wallet.routes.js';
import { subscriptionRouter } from './subscription.routes.js';
import careerIdentityRouter from './careerIdentity.routes.js';

const v1Router = Router();

v1Router.use('/auth', authRouter);
v1Router.use('/resumes', resumesRouter);
v1Router.use('/profile', profileRouter);
v1Router.use('/wallet', walletRouter);
v1Router.use('/subscription', subscriptionRouter);

// Placeholder routes (to be implemented):
// v1Router.use('/users', usersRouter);
// v1Router.use('/admins', adminsRouter);
// v1Router.use('/portfolio', portfolioRouter);
// v1Router.use('/analytics', analyticsRouter);
// v1Router.use('/storage', storageRouter);
// v1Router.use('/email', emailRouter);
// v1Router.use('/external', externalRouter);
v1Router.use('/career-identity', careerIdentityRouter);
// v1Router.use('/apple-wallet', appleWalletRouter);

export { v1Router };