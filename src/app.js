import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import path from "path";

import { healthRoutes } from "./routes/health.routes.js";
import { bookingsRoutes } from "./routes/bookings.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authenticate } from "./middlewares/auth.js"

import { BookingsRepo } from "./repositories/bookings.repo.js";
import { BookingsService } from "./services/bookings.service.js";
import { BookingsController } from "./controllers/bookings.controller.js";

export function buildApp() {
    const app = express();

    app.use("/static", express.static(path.resolve(process.cwd(), "src/static")));

    app.use(helmet());

    app.use(cors({
        origin: [
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    }));

    app.use(express.json({ limit: "1mb" }));

    app.use(
        rateLimit({
            windowMs: 60_000,
            max: 300,
            standardHeaders: true,
            legacyHeaders: false,
        })
    );

    // DI wiring
    const repo = new BookingsRepo();
    const service = new BookingsService(repo);
    const controller = new BookingsController(service);

    app.use("/api/v1", healthRoutes());
    app.use("/api/v1/bookings", bookingsRoutes(controller));

    app.use(errorHandler);
    return app;
}
