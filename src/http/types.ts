import type { Response } from "express";

export interface ApiMeta {
  timestamp: string;
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

export type ApiResponseBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export interface ApiResponse extends Response {
  success<T>(data: T, statusCode?: number): void;
}
