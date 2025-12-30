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
    router.post("/:id/payment-success", authenticate, bookingsController.markPaymentSuccessful);
    router.post("/:id/checkin", authenticate, bookingsController.checkinMe);
    router.get("/host/upcoming", authenticate, bookingsController.myActiveUpcommingBookings);

    // NEW #3: host approves booking
    router.post("/:id/host-approve", authenticate, bookingsController.hostApprove);

    return router;
}
