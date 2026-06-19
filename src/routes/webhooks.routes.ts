import { Router } from "express";
import { UserRole } from "../generated/prisma/client.js";
import { asyncHandler, sendSuccess } from "../http/index.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { requireRole } from "../middleware/require-role.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  registerWebhookBodySchema,
  testWebhookBodySchema,
  type RegisterWebhookBody,
  type TestWebhookBody,
} from "../schemas/requests/webhook.requests.js";
import {
  registerWebhook,
  sendTestWebhook,
} from "../services/webhook.service.js";

export const webhooksRouter = Router();

webhooksRouter.post(
  "/test",
  asyncHandler(authMiddleware),
  requireRole(UserRole.ADMIN),
  validateRequest({ body: testWebhookBodySchema }),
  asyncHandler(async (req, res) => {
    const body = req.validated!.body as TestWebhookBody;
    const result = await sendTestWebhook(req.user!.tenantId, body);
    sendSuccess(res, result);
  }),
);

webhooksRouter.post(
  "/",
  asyncHandler(authMiddleware),
  requireRole(UserRole.ADMIN),
  validateRequest({ body: registerWebhookBodySchema }),
  asyncHandler(async (req, res) => {
    const body = req.validated!.body as RegisterWebhookBody;
    const result = await registerWebhook(
      req.user!.tenantId,
      req.user!.id,
      body,
    );
    sendSuccess(res, result, result.created ? 201 : 200);
  }),
);
