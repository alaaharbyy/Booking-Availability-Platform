import type { UserRole } from "../generated/prisma/client.js";

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
}

export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface PublicUser {
  id: string;
  tenantId: string;
  email: string;
  role: UserRole;
}
