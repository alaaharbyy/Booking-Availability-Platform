import { BookingStatus } from "../generated/prisma/client.js";
import { ConflictError } from "../errors/index.js";


const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.RESERVED]: [
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELLED,
    BookingStatus.EXPIRED,
  ],
  [BookingStatus.CONFIRMED]: [BookingStatus.CANCELLED],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.EXPIRED]: [],
};

export function assertTransition(
  from: BookingStatus | null,
  to: BookingStatus,
): void {
  if (from === null) {
    if (to !== BookingStatus.RESERVED) {
      throw new ConflictError(
        `Invalid initial booking status: expected RESERVED, got ${to}`,
      );
    }
    return;
  }

  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new ConflictError(
      `Cannot transition booking from ${from} to ${to}`,
    );
  }
}

export function isCancellable(status: BookingStatus): boolean {
  return (
    status === BookingStatus.RESERVED || status === BookingStatus.CONFIRMED
  );
}
