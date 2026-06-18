import { Router } from "express";
import { asyncHandler, sendSuccess } from "../http/index.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  bookingRefParamsSchema,
  cancelBookingBodySchema,
  createBookingBodySchema,
  type BookingRefParams,
  type CancelBookingBody,
  type CreateBookingBody,
} from "../schemas/requests/booking.requests.js";
import {
  cancelReservation,
  confirmReservation,
  createReservation,
  getBookingDetail,
} from "../services/booking.service.js";

export const bookingsRouter = Router();

bookingsRouter.post(
  "/",
  asyncHandler(authMiddleware),
  validateRequest({ body: createBookingBodySchema }),
  asyncHandler(async (req, res) => {
    const body = req.validated!.body as CreateBookingBody;
    const result = await createReservation(
      req.user!.tenantId,
      req.user!.id,
      body,
    );
    sendSuccess(res, result, 201);
  }),
);

bookingsRouter.patch(
  "/:ref/confirm",
  asyncHandler(authMiddleware),
  validateRequest({ params: bookingRefParamsSchema }),
  asyncHandler(async (req, res) => {
    const { ref } = req.validated!.params as BookingRefParams;
    const result = await confirmReservation(
      req.user!.tenantId,
      req.user!.id,
      ref,
    );
    sendSuccess(res, result);
  }),
);

bookingsRouter.get(
  "/:ref",
  asyncHandler(authMiddleware),
  validateRequest({ params: bookingRefParamsSchema }),
  asyncHandler(async (req, res) => {
    const { ref } = req.validated!.params as BookingRefParams;
    const result = await getBookingDetail(
      req.user!.tenantId,
      req.user!.id,
      ref,
    );
    sendSuccess(res, result);
  }),
);

bookingsRouter.delete(
  "/:ref",
  asyncHandler(authMiddleware),
  validateRequest({
    params: bookingRefParamsSchema,
    body: cancelBookingBodySchema,
  }),
  asyncHandler(async (req, res) => {
    const { ref } = req.validated!.params as BookingRefParams;
    const { reason } = req.validated!.body as CancelBookingBody;
    const result = await cancelReservation(
      req.user!.tenantId,
      req.user!.id,
      ref,
      reason,
    );
    sendSuccess(res, result);
  }),
);
