// booking.repo.js
import { Booking } from "../models/Booking.js";

export class BookingsRepo {
    async create(doc) {
        const created = await Booking.create(doc);
        return created.toObject();
    }

    async findById(id) {
        const b = await Booking.findById(id).lean();
        return b ?? null;
    }

    async findByQrToken(qrcode_token) {
        const b = await Booking.findOne({ qrcode_token }).lean();
        return b ?? null;
    }

    async findByBookingId(id) {
        const b = await Booking.findById({ _id: id }).lean();
        return b ?? null;
    }

    async listByUser(userId, { limit = 50, offset = 0 }) {
        return Booking.find({ user_id: userId })
            .sort({ created_at: -1 })
            .skip(offset)
            .limit(limit)
            .lean();
    }

    async updateById(id, patch) {
        const updated = await Booking.findByIdAndUpdate(id, patch, {
            new: true,
            runValidators: true,
        }).lean();
        return updated ?? null;
    }

    async deleteById(id) {
        const res = await Booking.findByIdAndDelete(id).lean();
        return res?._id?.toString() ?? null;
    }

    async listHostUpcoming({ hostId, limit, offset }) {
        const filter = {
            "property_snapshot.host_id": hostId,
            checkout_status: { $in: ["not_checked_in", "checked_in"] },
            booking_status: { $nin: ["cancelled", "expired"] },
        };

        const items = await Booking.find(filter)
            .sort({ check_in_date: 1, created_at: -1 })
            .skip(offset)
            .limit(limit)
            .lean();

        const total = await Booking.countDocuments(filter);
        return { items, total, limit, offset };
    }


    async setBookingStatus({ bookingId, status, extraUpdate = {} }) {
        return Booking.findByIdAndUpdate(
            bookingId,
            { $set: { booking_status: status, ...extraUpdate } },
            { new: true }
        ).lean();
    }
}
