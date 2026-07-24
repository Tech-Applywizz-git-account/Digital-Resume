/**
 * Validation Middleware
 *
 * Validates request body, query, or params against a Zod schema.
 * Attaches validated data to req.validatedBody, req.validatedQuery.
 */
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validateBody(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            req.validatedBody = schema.parse(req.body);
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                next(createValidationError(err));
            } else {
                next(err);
            }
        }
    };
}

export function validateQuery(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            req.validatedQuery = schema.parse(req.query) as Record<string, string>;
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                next(createValidationError(err));
            } else {
                next(err);
            }
        }
    };
}

export function validateParams(schema: ZodSchema) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            req.validatedParams = schema.parse(req.params);
            next();
        } catch (err) {
            if (err instanceof ZodError) {
                next(createValidationError(err));
            } else {
                next(err);
            }
        }
    };
}

import { ValidationError } from '../types/errors.js';

function createValidationError(err: ZodError): ValidationError {
    return new ValidationError(
        err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
        })),
    );
}

declare global {
    namespace Express {
        interface Request {
            validatedBody?: unknown;
            validatedQuery?: Record<string, string>;
            validatedParams?: Record<string, string>;
        }
    }
}