import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/tokens.js";
import type { AuthenticatedUser } from "../auth/types.js";
import { UnauthorizedError } from "../errors/index.js";
import { prisma } from "../lib/prisma.js";

export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new UnauthorizedError("Missing or invalid authorization header"));
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    next(new UnauthorizedError("Missing access token"));
    return;
  }

  const payload = verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      tenantId: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    next(new UnauthorizedError("User not found or inactive"));
    return;
  }

  if (user.tenantId !== payload.tenantId || user.role !== payload.role) {
    next(new UnauthorizedError("Token no longer valid"));
    return;
  }

  const authenticatedUser: AuthenticatedUser = {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  };

  req.user = authenticatedUser;
  next();
}
