import dotenv from "dotenv";
dotenv.config();

export const config = {
    env: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 3007),

    mongoUri: process.env.MONGODB_URI,

    auth: {
        baseUrl: process.env.AUTH_BASE_URL ?? "http://127.0.0.1:8000",
        verifyPath:
            process.env.AUTH_VERIFY_PATH ?? "/api/v1/auth/token/verify/",
        mePath: process.env.AUTH_ME_PATH ?? "/api/v1/auth/me/",
        timeoutMs: Number(process.env.AUTH_TIMEOUT_MS ?? 2500),
        cacheTtlMs: Number(process.env.AUTH_CACHE_TTL_MS ?? 15000),
    },
};
