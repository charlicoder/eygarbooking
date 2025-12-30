// booking.service.js
import mongoose from "mongoose";
import { errors } from "../utils/errors.js";
import { config } from "../config/index.js";
import { generateQrPngFile } from "../utils/qrcode.js";

const ALLOWED_OWNER_STATUS_UPDATES = new Set(["draft", "pending_payment", "confirmed"]);

const CHECKOUT_STATUS = {
    NOT_CHECKED_IN: "not_checked_in",
    CHECKED_IN: "checked_in",
    CHECKED_OUT: "checked_out",
    COMPLETED: "completed",
    EXPIRED: "expired",
};

function ensureDateOrder(checkIn, checkOut) {
    const inD = new Date(checkIn);
    const outD = new Date(checkOut);
    if (!(outD > inD)) throw errors.badRequest("check_out_date must be after check_in_date");
}

function ensureNotBeforeCheckInDate(checkInDate) {
    const now = new Date();
    const inD = new Date(checkInDate);
    if (now < inD) {
        throw errors.badRequest("Cannot check in before check_in_date");
    }
}

export class BookingsService {
    constructor(bookingsRepo) {
        this.bookingsRepo = bookingsRepo;
        this.publicBaseUrl = config.publicBaseUrl;
    }

    async create({ user, payload }) {

        ensureDateOrder(payload.check_in_date, payload.check_out_date);


        if (payload.subtotal_amount + payload.cleaning_fee + payload.service_fee !== payload.total_amount) {
            throw errors.badRequest(
                "total_amount_cents must equal subtotal_amount_cents + fees_amount_cents"
            );
        }

        const bookingId = new mongoose.Types.ObjectId(); // pre-generate ID

        const qrPayload = JSON.stringify({
            booking_id: bookingId.toString(),
            // You can embed more info, but keep it minimal
        });

        const { token, filename } = await generateQrPngFile({
            payloadString: qrPayload,
            bookingId: bookingId.toString(),
        });

        const qrcodeUrl = `${this.publicBaseUrl}/static/qrcodes/${filename}`;

        const userSnapshot = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            avatar_url: user.avatar_url,
            stripe_customer_id: user.stripe_customer_id,
            is_email_verified: user.is_email_verified,
            host_id: user.host_id,
            vendor_id: user.vendor_id,

        };

        const bookingObject = {
            _id: bookingId,
            user_id: user.id,
            user_snapshot: userSnapshot,

            property_id: payload.property_id,
            property_snapshot: payload.property_snapshot,

            check_in_date: new Date(payload.check_in_date),
            check_out_date: new Date(payload.check_out_date),
            guests_count: payload.guests_count,

            currency: payload.currency.toUpperCase(),
            nights_stay: payload.nights_stay,
            price_per_night: payload.price_per_night,
            subtotal_amount: payload.subtotal_amount,
            service_fee: payload.service_fee,
            cleaning_fee: payload.cleaning_fee, // FIX: was payload.service_fee
            total_amount: payload.total_amount,

            payment_details: payload.payment_details ?? {},

            booking_status: "pending_payment",
            checkout_status: CHECKOUT_STATUS.NOT_CHECKED_IN, // NEW
            qrcode_token: token,
            qrcode_image_url: qrcodeUrl,
            qrcode_created_at: new Date(),
            qrcode_expires_at: new Date(payload.check_out_date),
            // qrcode_token, qrcode_image_base64 are generated in Booking model pre-save hook
        };

        try {
            return await this.bookingsRepo.create(bookingObject);
        } catch (e) {
            // Duplicate key (idempotency or qrcode_token)
            if (String(e?.code) === "11000")
                throw errors.conflict("Duplicate request (idempotency_key already used or duplicate qrcode)");
            throw e;
        }
    }

    async getMine({ userId, bookingId }) {
        const b = await this.bookingsRepo.findById(bookingId);
        if (!b) throw errors.notFound("Booking not found");
        if (b.user_id !== userId) throw errors.forbidden("You do not own this booking");
        return b;
    }

    async listMine({ userId, limit, offset }) {
        return this.bookingsRepo.listByUser(userId, { limit, offset });
    }

    async updateMine({ userId, bookingId, payload }) {
        const b = await this.bookingsRepo.findById(bookingId);
        if (!b) throw errors.notFound("Booking not found");
        if (b.user_id !== userId) throw errors.forbidden("You do not own this booking");

        // NOTE: your DB fields are booking_status / checkout_status.
        // Fix existing code that used "status"
        if (["cancelled", "completed", "expired"].includes(b.booking_status)) {
            throw errors.badRequest(`Cannot update booking in booking_status '${b.booking_status}'`);
        }

        if (payload.status && !ALLOWED_OWNER_STATUS_UPDATES.has(payload.status)) {
            throw errors.badRequest("Invalid status transition for booking owner");
        }

        // Owner should NOT be able to set checkout_status directly (security/control).
        // If you need that later for admin/kiosk, add a separate service method.

        const patch = {};
        if (payload.check_in_date) patch.check_in_date = new Date(payload.check_in_date);
        if (payload.check_out_date) patch.check_out_date = new Date(payload.check_out_date);
        if (payload.guests_count) patch.guests_count = payload.guests_count;
        if (payload.payment_details) patch.payment_details = payload.payment_details;
        if (payload.status) patch.booking_status = payload.status; // map to booking_status

        const finalCheckIn = patch.check_in_date ?? b.check_in_date;
        const finalCheckOut = patch.check_out_date ?? b.check_out_date;
        ensureDateOrder(finalCheckIn, finalCheckOut);

        const updated = await this.bookingsRepo.updateById(bookingId, patch);
        return updated;
    }

    async cancelMine({ userId, bookingId, reason }) {
        const b = await this.bookingsRepo.findById(bookingId);
        if (!b) throw errors.notFound("Booking not found");
        if (b.user_id !== userId) throw errors.forbidden("You do not own this booking");

        if (b.booking_status === "cancelled") return b;
        if (b.booking_status === "completed")
            throw errors.badRequest("Cannot cancel a completed booking");

        const updated = await this.bookingsRepo.updateById(bookingId, {
            booking_status: "cancelled",
            cancelled_at: new Date(),
            cancellation_reason: reason,
        });

        return updated;
    }

    async deleteMine({ userId, bookingId }) {
        const b = await this.bookingsRepo.findById(bookingId);
        if (!b) throw errors.notFound("Booking not found");
        if (b.user_id !== userId) throw errors.forbidden("You do not own this booking");

        if (["confirmed", "completed"].includes(b.booking_status)) {
            throw errors.badRequest(
                `Cannot delete booking in booking_status '${b.booking_status}'. Cancel instead.`
            );
        }

        const id = await this.bookingsRepo.deleteById(bookingId);
        return { id };
    }

    /**
     * OPTIONAL (recommended): internal method you can call from Stripe webhook handler
     * when payment succeeds, to set checkout_status => waiting_for_checkout
     */
    async markPaymentSuccessful({ bookingId, paymentDetails }) {
        const b = await this.bookingsRepo.findById(bookingId);
        console.log("b: ", b)
        if (!b) throw errors.notFound("Booking not found");

        // If already cancelled/expired/completed, ignore or throw based on your policy
        if (["cancelled", "expired", "completed"].includes(b.booking_status)) return b;

        const updated = await this.bookingsRepo.updateById(bookingId, {
            booking_status: "confirmed",
            payment_details: paymentDetails ?? b.payment_details,
        });

        return updated;
    }

    /**
     * OPTIONAL (recommended): kiosk/admin check-in method.
     * Enforces "cannot checked_in before check_in_date".
     */
    async checkInByQr({ qrcode_token }) {
        const b = await this.bookingsRepo.findByQrToken(qrcode_token);
        if (!b) throw errors.notFound("Booking not found");

        if (b.checkout_status !== CHECKOUT_STATUS.NOT_CHECKED_IN) {
            throw errors.badRequest(`Cannot check-in from checkout_status '${b.checkout_status}'`);
        }

        ensureNotBeforeCheckInDate(b.check_in_date);

        return this.bookingsRepo.updateById(b._id, {
            checkout_status: CHECKOUT_STATUS.CHECKED_IN,
        });
    }

    async checkInByBookingId(id) {
        const b = await this.bookingsRepo.findByBookingId(id);
        if (!b) throw errors.notFound("Booking not found");

        if (b.checkout_status !== CHECKOUT_STATUS.NOT_CHECKED_IN) {
            throw errors.badRequest(`Cannot check-in from checkout_status '${b.checkout_status}'`);
        }

        ensureNotBeforeCheckInDate(b.check_in_date);

        return this.bookingsRepo.updateById(b._id, {
            checkout_status: CHECKOUT_STATUS.CHECKED_IN,
        });
    }

    async myActiveUpcommingBookings({ hostId, limit, offset }) {
        return this.bookingsRepo.listHostUpcoming({ hostId, limit, offset });
    }

    async hostApproveBooking({ hostId, bookingId }) {
        const b = await this.bookingsRepo.findById(bookingId);
        if (!b) throw errors.notFound("Booking not found");

        const bookingHostId = b.property_snapshot?.host_id;
        if (!bookingHostId) throw errors.badRequest("Booking has no host_id in property_snapshot");
        if (bookingHostId !== hostId) throw errors.forbidden("Not allowed");

        if (b.booking_status !== "payment_confirmed") {
            throw errors.badRequest(`Booking must be payment_confirmed before host approval (current: ${b.booking_status})`);
        }

        return this.bookingsRepo.setBookingStatus({
            bookingId,
            status: "host_approved",
        });
    }
}
