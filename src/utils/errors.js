export class AppError extends Error {
    constructor(message, statusCode = 500, code = "INTERNAL_ERROR", details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

export const errors = {
    unauthorized(msg = "Unauthorized") {
        return new AppError(msg, 401, "UNAUTHORIZED");
    },
    forbidden(msg = "Forbidden") {
        return new AppError(msg, 403, "FORBIDDEN");
    },
    notFound(msg = "Not found") {
        return new AppError(msg, 404, "NOT_FOUND");
    },
    badRequest(msg = "Bad request", details) {
        return new AppError(msg, 400, "BAD_REQUEST", details);
    },
    conflict(msg = "Conflict") {
        return new AppError(msg, 409, "CONFLICT");
    },
};
