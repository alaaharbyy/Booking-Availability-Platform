import type { Response } from "express";
import { AppError } from "../errors/app-error.js";
import { InternalServerError } from "../errors/http-errors.js";
import { logger } from "../lib/logger.js";
import type { ApiErrorBody, ApiMeta, ApiSuccessBody } from "./types.js";

function meta(): ApiMeta {
  return { timestamp: new Date().toISOString() };
}

export function buildSuccess<T>(data: T): ApiSuccessBody<T> {
  return {
    success: true,
    data,
    meta: meta(),
  };
}

export function buildError(error: AppError): ApiErrorBody {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
    meta: meta(),
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
): void {
  res.status(statusCode).json(buildSuccess(data));
}

export function sendError(res: Response, error: unknown): void {
  const appError =
    error instanceof AppError ? error : new InternalServerError();

  if (error instanceof AppError) {
    if (appError.statusCode >= 500) {
      logger.error("Request failed", {
        code: appError.code,
        message: appError.message,
      });
    } else {
      logger.warn("Request rejected", {
        code: appError.code,
        message: appError.message,
        ...(appError.details !== undefined ? { details: appError.details } : {}),
      });
    }
  } else {
    logger.error("Unhandled request error", undefined, error);
  }

  res.status(appError.statusCode).json(buildError(appError));
}
