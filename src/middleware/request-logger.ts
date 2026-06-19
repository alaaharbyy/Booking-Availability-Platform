import type { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger.js";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const started = Date.now();

  res.on("finish", () => {
    const context = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - started,
      ...(req.user
        ? { tenantId: req.user.tenantId, userId: req.user.id, role: req.user.role }
        : {}),
    };

    if (res.statusCode >= 500) {
      logger.error("HTTP request completed", context);
      return;
    }

    if (res.statusCode >= 400) {
      logger.warn("HTTP request completed", context);
      return;
    }

    if (req.path === "/health") {
      logger.debug("HTTP request completed", context);
      return;
    }

    logger.info("HTTP request completed", context);
  });

  next();
}
