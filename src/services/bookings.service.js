import { errors } from "../utils/errors.js";

const ALLOWED_OWNER_STATUS_UPDATES = new Set([
    "draft",
    "pending_payment",
    "confirmed",
]);

function ensureDateOrder(checkIn, checkOut) {
    const inD = new Date(checkIn);
    const outD = new Date(checkOut);
    if (!(outD > inD))
        throw errors.badRequest("check_out_date must be after check_in_date");
}

export class BookingsService {
    constructor(bookingsRepo) {
        this.bookingsRepo = bookingsRepo;
    }

    async create({ user, payload }) {
        console.log("payload: ", payload)
        ensureDateOrder(payload.check_in_date, payload.check_out_date);

        if (
            payload.subtotal_amount + payload.cleaning_fee + payload.service_fee !==
            payload.total_amount
        ) {
            throw errors.badRequest(
                "total_amount_cents must equal subtotal_amount_cents + fees_amount_cents"
            );
        }

        console.log("user: ", user)

        const userSnapshot = {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            avatar_url: user.avatar_url,
            stripe_customer_id: user.stripe_customer_id,
            is_email_verified: user.is_email_verified,
        };

        try {
            return await this.bookingsRepo.create({
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
                cleaning_fee: payload.service_fee,
                total_amount: payload.total_amount,

                payment_details: payload.payment_details ?? {},
                booking_status: "pending_payment",
                
            });
        } catch (e) {
            // Duplicate key = idempotency conflict
            if (String(e?.code) === "11000")
                throw errors.conflict(
                    "Duplicate request (idempotency_key already used)"
                );
            throw e;
        }
    }

    async getMine({ userId, bookingId }) {
        const b = await this.bookingsRepo.findById(bookingId);
        if (!b) throw errors.notFound("Booking not found");
        if (b.user_id !== userId)
            throw errors.forbidden("You do not own this booking");
        return b;
    }

    async listMine({ userId, limit, offset }) {
        return this.bookingsRepo.listByUser(userId, { limit, offset });
    }

    async updateMine({ userId, bookingId, payload }) {
        const b = await this.bookingsRepo.findById(bookingId);
        if (!b) throw errors.notFound("Booking not found");
        if (b.user_id !== userId)
            throw errors.forbidden("You do not own this booking");

        if (["cancelled", "completed", "expired"].includes(b.status)) {
            throw errors.badRequest(
                `Cannot update booking in status '${b.status}'`
            );
        }

        if (
            payload.status &&
            !ALLOWED_OWNER_STATUS_UPDATES.has(payload.status)
        ) {
            throw errors.badRequest(
                "Invalid status transition for booking owner"
            );
        }

        const patch = {};
        if (payload.check_in_date)
            patch.check_in_date = new Date(payload.check_in_date);
        if (payload.check_out_date)
            patch.check_out_date = new Date(payload.check_out_date);
        if (payload.guests_count) patch.guests_count = payload.guests_count;
        if (payload.payment_details)
            patch.payment_details = payload.payment_details;
        if (payload.status) patch.status = payload.status;

        const finalCheckIn = patch.check_in_date ?? b.check_in_date;
        const finalCheckOut = patch.check_out_date ?? b.check_out_date;
        ensureDateOrder(finalCheckIn, finalCheckOut);

        const updated = await this.bookingsRepo.updateById(bookingId, patch);
        return updated;
    }

    async cancelMine({ userId, bookingId, reason }) {
        const b = await this.bookingsRepo.findById(bookingId);
        if (!b) throw errors.notFound("Booking not found");
        if (b.user_id !== userId)
            throw errors.forbidden("You do not own this booking");

        if (b.status === "cancelled") return b;
        if (b.status === "completed")
            throw errors.badRequest("Cannot cancel a completed booking");

        const updated = await this.bookingsRepo.updateById(bookingId, {
            status: "cancelled",
            cancelled_at: new Date(),
            cancellation_reason: reason,
        });

        return updated;
    }

    async deleteMine({ userId, bookingId }) {
        const b = await this.bookingsRepo.findById(bookingId);
        if (!b) throw errors.notFound("Booking not found");
        if (b.user_id !== userId)
            throw errors.forbidden("You do not own this booking");

        if (["confirmed", "completed"].includes(b.status)) {
            throw errors.badRequest(
                `Cannot delete booking in status '${b.status}'. Cancel instead.`
            );
        }

        const id = await this.bookingsRepo.deleteById(bookingId);
        return { id };
    }
}
