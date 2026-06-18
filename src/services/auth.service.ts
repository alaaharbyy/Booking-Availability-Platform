import bcrypt from "bcryptjs";
import { AuditEventType } from "../generated/prisma/client.js";
import {
  generateRefreshToken,
  hashToken,
  refreshTokenExpiresAt,
  signAccessToken,
} from "../auth/tokens.js";
import type { AuthTokens, PublicUser } from "../auth/types.js";
import { env } from "../config/env.js";
import {
  BadRequestError,
  UnauthorizedError,
} from "../errors/index.js";
import { prisma } from "../lib/prisma.js";

function toPublicUser(user: {
  id: string;
  tenantId: string;
  email: string;
  role: PublicUser["role"];
}): PublicUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    role: user.role,
  };
}

async function createRefreshSession(userId: string): Promise<string> {
  const refreshToken = generateRefreshToken();

  await prisma.$transaction(async (tx) => {
    const family = await tx.refreshTokenFamily.create({
      data: { userId },
    });

    await tx.refreshToken.create({
      data: {
        familyId: family.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshTokenExpiresAt(),
      },
    });
  });

  return refreshToken;
}

export async function login(
  tenantSlug: string,
  email: string,
  password: string,
): Promise<AuthTokens & { user: PublicUser }> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });

  if (!tenant) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const user = await prisma.user.findUnique({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: email.toLowerCase(),
      },
    },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const refreshToken = await createRefreshSession(user.id);

  await prisma.auditLog.create({
    data: {
      tenantId: tenant.id,
      actorUserId: user.id,
      eventType: AuditEventType.LOGIN,
      entityType: "User",
      entityId: user.id,
    },
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    expiresIn: env.jwtAccessExpiresInSeconds,
    user: toPublicUser(user),
  };
}

export async function refreshAccessToken(
  refreshToken: string,
): Promise<AuthTokens> {
  if (!refreshToken) {
    throw new BadRequestError("Refresh token is required");
  }

  const storedToken = await prisma.refreshToken.findFirst({
    where: { tokenHash: hashToken(refreshToken) },
    include: {
      family: {
        include: { user: true },
      },
    },
  });

  if (!storedToken) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const { family } = storedToken;
  const user = family.user;

  if (family.revoked) {
    throw new UnauthorizedError("Session revoked");
  }

  if (storedToken.revoked) {
    await prisma.$transaction([
      prisma.refreshTokenFamily.update({
        where: { id: family.id },
        data: { revoked: true },
      }),
      prisma.refreshToken.updateMany({
        where: { familyId: family.id },
        data: { revoked: true },
      }),
    ]);

    throw new UnauthorizedError("Refresh token reuse detected");
  }

  if (storedToken.expiresAt <= new Date()) {
    throw new UnauthorizedError("Refresh token expired");
  }

  if (!user.isActive) {
    throw new UnauthorizedError("Account disabled");
  }

  const nextRefreshToken = generateRefreshToken();

  await prisma.$transaction(async (tx) => {
    const replacement = await tx.refreshToken.create({
      data: {
        familyId: family.id,
        tokenHash: hashToken(nextRefreshToken),
        expiresAt: refreshTokenExpiresAt(),
      },
    });

    await tx.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        revoked: true,
        replacedById: replacement.id,
      },
    });
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken: nextRefreshToken,
    expiresIn: env.jwtAccessExpiresInSeconds,
  };
}

export async function logout(refreshToken: string): Promise<void> {
  if (!refreshToken) {
    throw new BadRequestError("Refresh token is required");
  }

  const storedToken = await prisma.refreshToken.findFirst({
    where: { tokenHash: hashToken(refreshToken) },
    include: {
      family: {
        include: { user: true },
      },
    },
  });

  if (!storedToken) {
    return;
  }

  await prisma.$transaction([
    prisma.refreshTokenFamily.update({
      where: { id: storedToken.familyId },
      data: { revoked: true },
    }),
    prisma.refreshToken.updateMany({
      where: { familyId: storedToken.familyId },
      data: { revoked: true },
    }),
    prisma.auditLog.create({
      data: {
        tenantId: storedToken.family.user.tenantId,
        actorUserId: storedToken.family.user.id,
        eventType: AuditEventType.LOGOUT,
        entityType: "User",
        entityId: storedToken.family.user.id,
      },
    }),
  ]);
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedError("User not found or inactive");
  }

  return toPublicUser(user);
}
