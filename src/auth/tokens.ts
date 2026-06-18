import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { User } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../errors/index.js";
import type { AccessTokenPayload } from "./types.js";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export function refreshTokenExpiresAt(): Date {
  return new Date(Date.now() + env.jwtRefreshExpiresInSeconds * 1000);
}

export function signAccessToken(user: Pick<User, "id" | "tenantId" | "role" | "email">): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    tenantId: user.tenantId,
    role: user.role,
    email: user.email,
  };

  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpiresInSeconds,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwtAccessSecret);
    if (typeof decoded !== "object" || decoded === null) {
      throw new UnauthorizedError("Invalid access token");
    }

    const { sub, tenantId, role, email } = decoded as Partial<AccessTokenPayload>;
    if (!sub || !tenantId || !role || !email) {
      throw new UnauthorizedError("Invalid access token");
    }

    return { sub, tenantId, role, email };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError("Invalid or expired access token");
  }
}
