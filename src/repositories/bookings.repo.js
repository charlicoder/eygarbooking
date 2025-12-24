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
}
