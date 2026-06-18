function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseDurationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration format: ${duration}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 60 * 60 * 24;
    default:
      throw new Error(`Unsupported duration unit: ${unit}`);
  }
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid numeric environment variable: ${name}`);
  }
  return parsed;
}

const jwtAccessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
const jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? "30d";

export const env = {
  port: optionalInt("PORT", 3000),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwtAccessSecret: requireEnv("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? requireEnv("JWT_ACCESS_SECRET"),
  jwtAccessExpiresIn,
  jwtRefreshExpiresIn,
  jwtAccessExpiresInSeconds: parseDurationToSeconds(jwtAccessExpiresIn),
  jwtRefreshExpiresInSeconds: parseDurationToSeconds(jwtRefreshExpiresIn),
} as const;
