import { Router } from "express";
import { asyncHandler, sendSuccess } from "../http/index.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  loginBodySchema,
  refreshTokenBodySchema,
} from "../schemas/requests/auth.requests.js";
import {
  getCurrentUser,
  login,
  logout,
  refreshAccessToken,
} from "../services/auth.service.js";

export const authRouter = Router();

authRouter.post(
  "/login",
  validateRequest({ body: loginBodySchema }),
  asyncHandler(async (req, res) => {
    const { tenantSlug, email, password } = req.body;
    const result = await login(tenantSlug, email, password);
    sendSuccess(res, result);
  }),
);

authRouter.post(
  "/refresh",
  validateRequest({ body: refreshTokenBodySchema }),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const tokens = await refreshAccessToken(refreshToken);
    sendSuccess(res, tokens);
  }),
);

authRouter.post(
  "/logout",
  validateRequest({ body: refreshTokenBodySchema }),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    await logout(refreshToken);
    sendSuccess(res, { loggedOut: true });
  }),
);

authRouter.get(
  "/me",
  asyncHandler(authMiddleware),
  asyncHandler(async (req, res) => {
    const user = await getCurrentUser(req.user!.id);
    sendSuccess(res, { user });
  }),
);
