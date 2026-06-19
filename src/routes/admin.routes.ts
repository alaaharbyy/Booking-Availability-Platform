import { Router } from "express";
import { UserRole } from "../generated/prisma/client.js";
import { asyncHandler, sendSuccess } from "../http/index.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  adminBookingListQuerySchema,
  auditLogListQuerySchema,
  type AdminBookingListQuery,
  type AuditLogListQuery,
} from "../schemas/requests/admin.requests.js";
import { listTenantBookings } from "../services/admin-booking.service.js";
import { listAuditLogs } from "../services/audit-log.service.js";

export const adminRouter = Router();

adminRouter.get(
  "/bookings",
  asyncHandler(authMiddleware),
  requireRole(UserRole.ADMIN, UserRole.TRAVEL_MANAGER),
  validateRequest({ query: adminBookingListQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await listTenantBookings(
      req.user!.tenantId,
      req.validated!.query as AdminBookingListQuery,
    );
    sendSuccess(res, result);
  }),
);

adminRouter.get(
  "/audit-log",
  asyncHandler(authMiddleware),
  requireRole(UserRole.ADMIN),
  validateRequest({ query: auditLogListQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await listAuditLogs(
      req.user!.tenantId,
      req.validated!.query as AuditLogListQuery,
    );
    sendSuccess(res, result);
  }),
);
