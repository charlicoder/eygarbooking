import mongoose from "mongoose";
import crypto from "crypto";

const CHECKOUT_STATUSES = [
    "not_checked_in",
    "checked_in",
    "checked_out",
    "completed",
    "expired",
];

const BOOKING_STATUSES = [
    "draft",
    "pending_payment",
    "payment_confirmed",
    "booking_confirmed",  // renamed from "confirmed"
    "host_approved",      // new
    "cancelled",
    "completed",
    "expired",
];

function generateQrCodeToken() {
    // Node 16+ supports base64url; if you ever downgrade, replace with base64 + sanitize
    return crypto.randomBytes(24).toString("base64url");
}

const BookingSchema = new mongoose.Schema(
    {
        user_id: { type: String, required: true, index: true },
        user_snapshot: { type: Object, required: true },

        property_id: { type: String, required: true, index: true },
        property_snapshot: { type: Object, required: true },

        check_in_date: { type: Date, required: true },
        check_out_date: { type: Date, required: true },
        guests_count: { type: Number, required: true, min: 1 },

        currency: { type: String, required: true, minlength: 3, maxlength: 3 },
        nights_stay: { type: Number, required: true, min: 0 },

        // NOTE: in your stored data these look like "minor units" (e.g., 32000 = 320.00 QAR)
        price_per_night: { type: Number, required: true, min: 0 },
        subtotal_amount: { type: Number, required: true, min: 0 },
        service_fee: { type: Number, required: true, min: 0 },
        cleaning_fee: { type: Number, required: true, min: 0 },
        total_amount: { type: Number, required: true, min: 0 },

        payment_details: { type: Object, default: {} },

        booking_status: {
            type: String,
            enum: BOOKING_STATUSES,
            default: "pending_payment",
            index: true,
        },

        checkout_status: {
            type: String,
            enum: CHECKOUT_STATUSES,
            default: "not_checked_in",
            index: true,
        },

        idempotency_key: { type: String, default: null },

        qrcode_token: {
            type: String,
            required: true,
            unique: true,
            index: true,
            immutable: true,
        },
        qrcode_image_url: { type: String, required: true },
        qrcode_created_at: { type: Date, default: null },
        qrcode_expires_at: { type: Date, default: null },

        cancelled_at: { type: Date, default: null },
        cancellation_reason: { type: String, default: null },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

/**
 * Core validation:
 * - check_out_date must be after check_in_date
 * - checkout_status cannot be "checked_in" before check_in_date
 */
BookingSchema.pre("validate", async function (next) {
    if (this.check_in_date && this.check_out_date && this.check_out_date <= this.check_in_date) {
        return next(new Error("check_out_date must be after check_in_date"));
    }

    const now = Date.now();
    const checkIn = this.check_in_date ? this.check_in_date.getTime() : null;

    if (this.checkout_status === "checked_in" && checkIn != null && now < checkIn) {
        return next(new Error("Cannot check in before check_in_date"));
    }

    next();
});


// Indexes
BookingSchema.index({ user_id: 1, created_at: -1 });

BookingSchema.index(
    { user_id: 1, idempotency_key: 1 },
    {
        unique: true,
        partialFilterExpression: { idempotency_key: { $type: "string" } },
    }
);

// Recommended: host upcoming lookup index
BookingSchema.index({
    "property_snapshot.host_id": 1,
    checkout_status: 1,
    check_in_date: 1,
});

BookingSchema.index({ property_id: 1, check_in_date: 1, check_out_date: 1 });

export const Booking = mongoose.model("Booking", BookingSchema);

