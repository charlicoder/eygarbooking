import { LRUCache } from "lru-cache";
import { httpJson } from "../utils/httpClient.js";
import { errors } from "../utils/errors.js";
import { config } from "../config/index.js";

const cache = new LRUCache({ max: 5000, ttl: config.auth.cacheTtlMs });

export async function authenticate(req, _res, next) {
    try {
        const auth = req.headers.authorization;

        if (!auth?.startsWith("Bearer ")) throw errors.unauthorized();

        const token = auth.slice("Bearer ".length).trim();
        if (!token) throw errors.unauthorized();

        const cached = cache.get(token);
        if (cached) {
            req.user = cached;
            req.accessToken = token;
            return next();
        }

        const verifyUrl = new URL(
            config.auth.verifyPath,
            config.auth.baseUrl
        ).toString();
        const meUrl = new URL(
            config.auth.mePath,
            config.auth.baseUrl
        ).toString();

        const verifyRes = await httpJson({
            url: verifyUrl,
            method: "POST",
            headers: { "content-type": "application/json" },
            data: { token },
            timeoutMs: config.auth.timeoutMs,
        });

        if (verifyRes.statusCode !== 200)
            throw errors.unauthorized("Invalid or expired token");

        const meRes = await httpJson({
            url: meUrl,
            method: "GET",
            headers: { authorization: `Bearer ${token}` },
            timeoutMs: config.auth.timeoutMs,
        });


        if (meRes.statusCode !== 200 || !meRes.data?.id) {
            throw errors.unauthorized("Unable to load user profile");
        }

        const user = {
            id: meRes.data.id,
            email: meRes.data.email,
            first_name: meRes.data.first_name,
            last_name: meRes.data.last_name,
            avatar_url: meRes.data.avatar_url,
            stripe_customer_id: meRes.data.stripe_customer_id,
            is_email_verified: meRes.data.is_email_verified,
            host_id: meRes.data?.eygar_host?.id,
            vendor_id: meRes.data?.eygar_vendor?.id,
        };

        cache.set(token, user);
        req.user = user;
        req.accessToken = token;
        return next();
    } catch (err) {
        return next(err);
    }
}
