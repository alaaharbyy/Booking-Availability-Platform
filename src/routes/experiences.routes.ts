import { Router } from "express";
import { asyncHandler, sendSuccess } from "../http/index.js";
import { authMiddleware } from "../middleware/auth_middleware.js";
import { validateRequest } from "../middleware/validate-request.js";
import {
  experienceDetailQuerySchema,
  experienceIdParamsSchema,
  experienceSearchQuerySchema,
  type ExperienceDetailQuery,
  type ExperienceIdParams,
  type ExperienceSearchQuery,
} from "../schemas/requests/experience.requests.js";
import {
  getExperienceDetail,
  searchExperiences,
} from "../services/experience.service.js";

export const experiencesRouter = Router();

experiencesRouter.get(
  "/",
  asyncHandler(authMiddleware),
  validateRequest({ query: experienceSearchQuerySchema }),
  asyncHandler(async (req, res) => {
    const result = await searchExperiences(
      req.user!.tenantId,
      req.validated!.query as ExperienceSearchQuery,
    );
    sendSuccess(res, result);
  }),
);

experiencesRouter.get(
  "/:id",
  asyncHandler(authMiddleware),
  validateRequest({
    params: experienceIdParamsSchema,
    query: experienceDetailQuerySchema,
  }),
  asyncHandler(async (req, res) => {
    const { id } = req.validated!.params as ExperienceIdParams;
    const result = await getExperienceDetail(
      req.user!.tenantId,
      id,
      req.validated!.query as ExperienceDetailQuery,
    );
    sendSuccess(res, result);
  }),
);
