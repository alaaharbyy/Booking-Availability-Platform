import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ZodError } from "zod";
import { BadRequestError } from "../errors/index.js";

type RequestPart = "body" | "query" | "params";

type RequestSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

const invalidRequestMessages: Record<RequestPart, string> = {
  body: "Invalid request body",
  query: "Invalid query parameters",
  params: "Invalid route parameters",
};

function formatZodIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}

export function validateRequest(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parts: Array<[RequestPart, ZodType, unknown]> = [];

    if (schemas.body) {
      parts.push(["body", schemas.body, req.body ?? {}]);
    }

    if (schemas.query) {
      parts.push(["query", schemas.query, req.query]);
    }

    if (schemas.params) {
      parts.push(["params", schemas.params, req.params]);
    }

    for (const [part, schema, value] of parts) {
      try {
        const parsed = schema.parse(value);

        req.validated ??= {};

        if (part === "body") {
          req.body = parsed;
          req.validated.body = parsed;
        } else if (part === "query") {
          req.validated.query = parsed;
        } else {
          req.validated.params = parsed;
        }
      } catch (error) {
        if (error instanceof ZodError) {
          next(
            new BadRequestError(invalidRequestMessages[part], {
              issues: formatZodIssues(error),
            }),
          );
          return;
        }

        next(error);
        return;
      }
    }

    next();
  };
}
