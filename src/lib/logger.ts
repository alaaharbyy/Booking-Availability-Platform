type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }

  return "info";
}

const minLevel = configuredLevel();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

function serializeError(err: unknown): LogContext | undefined {
  if (!(err instanceof Error)) {
    return err === undefined ? undefined : { error: err };
  }

  return {
    errorName: err.name,
    errorMessage: err.message,
    ...(err.stack ? { stack: err.stack } : {}),
  };
}

function write(
  level: LogLevel,
  message: string,
  context?: LogContext,
  err?: unknown,
): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    ...(context ?? {}),
    ...serializeError(err),
  };

  const suffix =
    Object.keys(payload).length > 0 ? ` ${JSON.stringify(payload)}` : "";
  const line = `[${new Date().toISOString()}] ${level.toUpperCase().padEnd(5)} ${message}${suffix}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    write("debug", message, context);
  },

  info(message: string, context?: LogContext): void {
    write("info", message, context);
  },

  warn(message: string, context?: LogContext, err?: unknown): void {
    write("warn", message, context, err);
  },

  error(message: string, context?: LogContext, err?: unknown): void {
    write("error", message, context, err);
  },
};
