/**
 * Custom Error Classes
 *
 * Typed errors that the global error handler catches and returns
 * as structured JSON responses. Never throw raw Error objects.
 */
export class AppError extends Error {
    constructor(
        public statusCode: number,
        public code: string,
        message: string,
        public details?: unknown,
    ) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, id?: string) {
        const suffix = id ? ` with identifier '${id}'` : '';
        super(404, `${resource.toUpperCase()}_NOT_FOUND`, `${resource}${suffix} not found`);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Authentication is required') {
        super(401, 'UNAUTHORIZED', message);
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'You do not have permission to perform this action') {
        super(403, 'FORBIDDEN', message);
    }
}

export class ValidationError extends AppError {
    constructor(details: unknown) {
        super(422, 'VALIDATION_ERROR', 'Request validation failed', details);
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(409, 'CONFLICT', message);
    }
}

export class RateLimitError extends AppError {
    constructor(message = 'Too many requests. Please try again later.') {
        super(429, 'RATE_LIMIT_EXCEEDED', message);
    }
}

export class ExternalServiceError extends AppError {
    constructor(service: string, message: string) {
        super(502, `${service.toUpperCase()}_ERROR`, `External service '${service}' returned an error: ${message}`);
    }
}