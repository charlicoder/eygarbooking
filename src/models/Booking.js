import mongoose from "mongoose";
import crypto from "crypto";
import QRCode from "qrcode";

const CHECKOUT_STATUSES = [
    "pending_payment",
    "waiting_for_checkout",
    "checked_in",
    "checked_out",
    "completed",
    "expired",
];

function generateQrCodeToken() {
    return crypto.randomBytes(24).toString("base64url"); // Node 16+ supports base64url
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
        price_per_night: { type: Number, required: true, min: 0 },
        subtotal_amount: { type: Number, required: true, min: 0 },
        service_fee: { type: Number, required: true, min: 0 },
        cleaning_fee: { type: Number, required: true, min: 0 },
        total_amount: { type: Number, required: true, min: 0 },

        payment_details: { type: Object, default: {} },

        booking_status: {
            type: String,
            enum: [
                "draft",
                "pending_payment",
                "confirmed",
                "cancelled",
                "completed",
                "expired",
            ],
            default: "pending_payment",
            index: true,
        },

        checkout_status: {
            type: String,
            enum: CHECKOUT_STATUSES,
            default: "pending_payment",
            index: true,
        },
        qrcode_token: {
            type: String,
            required: true,
            unique: true,
            index: true,
            immutable: true,
        },
        qrcode_image_base64: {
            type: String,
            required: true,
        },
        qrcode_created_at: { type: Date, default: null },
        qrcode_expires_at: { type: Date, default: null },

        cancelled_at: { type: Date, default: null },
        cancellation_reason: { type: String, default: null },
    },
    { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);


/**
 * Core validation: checkout_status cannot be "checked_in" before check_in_date.
 * Also ensures date ordering sanity.
 */
BookingSchema.pre("validate", function (next) {
    if (this.check_in_date && this.check_out_date && this.check_out_date <= this.check_in_date) {
        return next(new Error("check_out_date must be after check_in_date"));
    }

    const now = new Date();
    if (this.checkout_status === "checked_in" && now < this.check_in_date) {
        return next(new Error("Cannot check in before check_in_date"));
    }

    next();
});


/**
 * Ensure a QR code token exists at creation time.
 * This runs for new documents created via `.save()` / `Model.create()`.
 */
BookingSchema.pre("save", async function (next) {
    if (!this.isNew) return next();

    try {
        // Generate token
        this.qrcode_token = generateQrCodeToken();
        this.qrcode_created_at = new Date();

        /**
         * What the QR encodes:
         * - You can change this to a URL, deep link, or API endpoint
         */
        const qrPayload = JSON.stringify({
            booking_id: this._id.toString(),
            token: this.qrcode_token,
        });

        // Generate QR image as Base64 PNG
        this.qrcode_image_base64 = await QRCode.toDataURL(qrPayload, {
            errorCorrectionLevel: "H",
            type: "image/png",
            margin: 1,
            width: 512,
        });

        next();
    } catch (err) {
        next(err);
    }
});


/**
 * Handle uniqueness collisions gracefully:
 * If the generated token collides (extremely unlikely), retry a few times.
 */
BookingSchema.post("save", async function (error, doc, next) {
    const isDuplicate =
        error?.code === 11000 &&
        (error.keyPattern?.qrcode_token || error.keyValue?.qrcode_token);

    if (!isDuplicate) return next(error);

    try {
        for (let i = 0; i < 5; i++) {
            doc.qrcode_token = generateQrCodeToken();

            const qrPayload = JSON.stringify({
                booking_id: doc._id.toString(),
                token: doc.qrcode_token,
            });

            doc.qrcode_image_base64 = await QRCode.toDataURL(qrPayload, {
                errorCorrectionLevel: "H",
                width: 512,
            });

            await doc.save();
            return next();
        }

        next(new Error("Failed to generate unique QR code after retries"));
    } catch (err) {
        next(err);
    }
});

// Fast lookup: user bookings sorted
BookingSchema.index({ user_id: 1, created_at: -1 });

// Avoid duplicate booking creation on retries for the same user
BookingSchema.index(
    { user_id: 1, idempotency_key: 1 },
    {
        unique: true,
        partialFilterExpression: { idempotency_key: { $type: "string" } },
    }
);

// Optional: help search by property and dates
BookingSchema.index({ property_id: 1, check_in_date: 1, check_out_date: 1 });

export const Booking = mongoose.model("Booking", BookingSchema);
