import { AppError } from "../utils/errors.js";

export function errorHandler(err, _req, res, _next) {
    const status = err instanceof AppError ? err.statusCode : 500;

    const payload = {
        message: err.message ?? "Internal server error",
        code: err.code ?? "INTERNAL_ERROR",
    };

    if (err.details) payload.details = err.details;

    return res.status(status).json(payload);
}
