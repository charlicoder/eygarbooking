import express from "express";
import { authenticate } from "../middlewares/auth.js";

export function bookingsRoutes(bookingsController) {
    const router = express.Router();

    router.post("/", authenticate, bookingsController.create);
    router.get("/mine", authenticate, bookingsController.listMine);
    router.get("/:id", authenticate, bookingsController.getMine);
    router.patch("/:id", authenticate, bookingsController.updateMine);
    router.post("/:id/cancel", authenticate, bookingsController.cancelMine);
    router.delete("/:id", authenticate, bookingsController.deleteMine);

    return router;
}
