import type { BookingStatusValue } from "./booking.responses.js";
import type { PaginationMeta } from "./pagination.responses.js";

export type AdminBookingListItem = {
  booking_ref: string;
  status: BookingStatusValue;
  party_size: number;
  total_price: string;
  reserved_until: string | null;
  created_at: string;
  user: {
    id: string;
    email: string;
  };
  experience: {
    id: string;
    title: string;
  };
  slot: {
    id: string;
    starts_at: string;
    ends_at: string;
  };
};

export type AdminBookingListResult = {
  items: AdminBookingListItem[];
  pagination: PaginationMeta;
};

export type AuditLogListItem = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  actor: {
    id: string;
    email: string;
  } | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AuditLogListResult = {
  items: AuditLogListItem[];
  pagination: PaginationMeta;
};
