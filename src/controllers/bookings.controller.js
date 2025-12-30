// booking.controller.js
import { CreateBookingSchema, UpdateBookingSchema, CancelBookingSchema } from "../utils/validate.js";
import { errors } from "../utils/errors.js";

export class BookingsController {
    constructor(bookingsService) {
        this.bookingsService = bookingsService;

        this.create = this.create.bind(this);
        this.listMine = this.listMine.bind(this);
        this.getMine = this.getMine.bind(this);
        this.updateMine = this.updateMine.bind(this);
        this.cancelMine = this.cancelMine.bind(this);
        this.deleteMine = this.deleteMine.bind(this);

        // OPTIONAL endpoints if you add routes
        this.markPaymentSuccessful = this.markPaymentSuccessful.bind(this);
        this.checkInByQr = this.checkInByQr.bind(this);
        this.checkinMe = this.checkinMe.bind(this);

        this.myActiveUpcommingBookings = this.myActiveUpcommingBookings.bind(this);
        this.hostApprove = this.hostApprove.bind(this);
    }

    async create(req, res, next) {
        console.log("req.user: ", req.user)
        console.log("req.body: ", req.body)
        try {
            const parsed = CreateBookingSchema.safeParse(req.body);
            console.log("parsed: ", parsed)
            if (!parsed.success) throw errors.badRequest("Validation error", parsed.error.flatten());

            const booking = await this.bookingsService.create({
                user: req.user,
                payload: parsed.data,
            });
            // booking will include qrcode_token + qrcode_image_base64 if schema/model is updated as discussed
            return res.status(201).json(booking);
        } catch (err) {
            return next(err);
        }
    }

    async listMine(req, res, next) {
        console.log("req.user: ", req.user)
        try {
            const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
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
            if (!parsed.success) throw errors.badRequest("Validation error", parsed.error.flatten());

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
            if (!parsed.success) throw errors.badRequest("Validation error", parsed.error.flatten());

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

    async markPaymentSuccessful(req, res, next) {
        try {
            const bookingId = req.params.id;

            if (!bookingId) {
                throw errors.badRequest("bookingId is required");
            }

            // paymentDetails can be full gateway payload (Stripe, etc.)
            const paymentDetails = req.body?.payment_details ?? {};

            const booking = await this.bookingsService.markPaymentSuccessful({
                bookingId,
                paymentDetails,
            });

            return res.json({
                success: true,
                booking,
            });
        } catch (err) {
            return next(err);
        }
    }

    /**
     * OPTIONAL: if you add a public/kiosk route for QR check-in, e.g. POST /bookings/checkin
     * body: { qrcode_token: "..." }
     */
    async checkInByQr(req, res, next) {
        try {
            const token = req.body?.qrcode_token;
            if (!token) throw errors.badRequest("qrcode_token is required");

            const booking = await this.bookingsService.checkInByQr({ qrcode_token: token });
            return res.json(booking);
        } catch (err) {
            return next(err);
        }
    }

    async checkinMe(req, res, next) {
        try {
            const { id } = req.params;
            if (!id) throw errors.badRequest("id is required");

            const booking = await this.bookingsService.checkInByBookingId(id);
            return res.json(booking);
        } catch (err) {
            return next(err);
        }
    }

    async myActiveUpcommingBookings(req, res, next) {
        try {
            const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 100);
            const offset = Math.max(Number(req.query.offset ?? 0), 0);

            const list = await this.bookingsService.myActiveUpcommingBookings({
                hostId: req.user.host_id,
                limit,
                offset,
            });

            return res.json(list);
        } catch (err) {
            return next(err);
        }
    }

    /**
     * NEW #3: Host approves booking
     * POST /bookings/:id/host-approve
     */
    async hostApprove(req, res, next) {
        try {
            const bookingId = req.params.id;
            if (!bookingId) throw errors.badRequest("bookingId is required");

            const booking = await this.bookingsService.hostApproveBooking({
                hostId: req.user.id,
                bookingId,
            });

            return res.json({ success: true, booking });
        } catch (err) {
            return next(err);
        }
    }
}
