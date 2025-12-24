import { z } from "zod";

export const CreateBookingSchema = z.object({
    property_id: z.string().min(8),
    property_snapshot: z.record(z.any()),

    check_in_date: z.string().datetime(),
    check_out_date: z.string().datetime(),
    guests_count: z.number().int().min(1).max(50),

    currency: z.string().length(3),

    nights_stay: z.number().int().min(0),
    price_per_night: z.number().int().min(0),
    subtotal_amount: z.number().int().min(0),
    service_fee: z.number().int().min(0),
    cleaning_fee: z.number().int().min(0),
    total_amount: z.number().int().min(0),

    payment_details: z.record(z.any()).optional().default({}),
});

export const UpdateBookingSchema = z.object({
    check_in_date: z.string().date().optional(),
    check_out_date: z.string().date().optional(),
    guests_count: z.number().int().min(1).max(50).optional(),

    payment_details: z.record(z.any()).optional(),
    booking_status: z
        .enum([
            "draft",
            "pending_payment",
            "confirmed",
            "cancelled",
            "completed",
            "expired",
        ])
        .optional(),
});

export const CancelBookingSchema = z.object({
    reason: z.string().min(2).max(500),
});
