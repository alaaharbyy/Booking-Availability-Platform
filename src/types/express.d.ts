import type { AuthenticatedUser } from "../auth/types.js";

type ValidatedRequest = {
  body?: unknown;
  query?: unknown;
  params?: unknown;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      validated?: ValidatedRequest;
    }
  }
}

export {};
