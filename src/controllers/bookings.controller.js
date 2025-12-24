import {
    CreateBookingSchema,
    UpdateBookingSchema,
    CancelBookingSchema,
} from "../utils/validate.js";
import { errors } from "../utils/errors.js";

export class BookingsController {
    constructor(bookingsService) {
        this.bookingsService = bookingsService;

        // bind for Express
        this.create = this.create.bind(this);
        this.listMine = this.listMine.bind(this);
        this.getMine = this.getMine.bind(this);
        this.updateMine = this.updateMine.bind(this);
        this.cancelMine = this.cancelMine.bind(this);
        this.deleteMine = this.deleteMine.bind(this);
    }

    async create(req, res, next) {
        console.log("req: ", req)
        try {
            const parsed = CreateBookingSchema.safeParse(req.body);
            console.log("parsed: ", parsed)
            if (!parsed.success)
                throw errors.badRequest(
                    "Validation error",
                    parsed.error.flatten()
                );

            const booking = await this.bookingsService.create({
                user: req.user,
                payload: parsed.data,
            });
            return res.status(201).json(booking);
        } catch (err) {
            return next(err);
        }
    }

    async listMine(req, res, next) {
        try {
            const limit = Math.min(
                Math.max(Number(req.query.limit ?? 50), 1),
                100
            );
            const offset = Math.max(Number(req.query.offset ?? 0), 0);

            const list = await this.bookingsService.listMine({
                userId: req.user.id,
                limit,
                offset,
            });
            return res.json(list);
        } catch (err) {
            return next(err);
        }
    }

    async getMine(req, res, next) {
        try {
            const booking = await this.bookingsService.getMine({
                userId: req.user.id,
                bookingId: req.params.id,
            });
            return res.json(booking);
        } catch (err) {
            return next(err);
        }
    }

    async updateMine(req, res, next) {
        try {
            const parsed = UpdateBookingSchema.safeParse(req.body);
            if (!parsed.success)
                throw errors.badRequest(
                    "Validation error",
                    parsed.error.flatten()
                );

            const booking = await this.bookingsService.updateMine({
                userId: req.user.id,
                bookingId: req.params.id,
                payload: parsed.data,
            });

            return res.json(booking);
        } catch (err) {
            return next(err);
        }
    }

    async cancelMine(req, res, next) {
        try {
            const parsed = CancelBookingSchema.safeParse(req.body);
            if (!parsed.success)
                throw errors.badRequest(
                    "Validation error",
                    parsed.error.flatten()
                );

            const booking = await this.bookingsService.cancelMine({
                userId: req.user.id,
                bookingId: req.params.id,
                reason: parsed.data.reason,
            });

            return res.json(booking);
        } catch (err) {
            return next(err);
        }
    }

    async deleteMine(req, res, next) {
        try {
            const result = await this.bookingsService.deleteMine({
                userId: req.user.id,
                bookingId: req.params.id,
            });

            return res.json(result);
        } catch (err) {
            return next(err);
        }
    }
}
