import express from "express";

export function healthRoutes() {
    const router = express.Router();
    router.get("/health", (_req, res) => res.json({ ok: true }));
    return router;
}
