export type BookingStatusValue =
  | "RESERVED"
  | "CONFIRMED"
  | "CANCELLED"
  | "EXPIRED";

export type BookingSummary = {
  booking_ref: string;
  status: BookingStatusValue;
  party_size: number;
  total_price: string;
  reserved_until: string | null;
};

export type BookingTimelineEntry = {
  from_status: BookingStatusValue | null;
  to_status: BookingStatusValue;
  reason: string | null;
  actor_user_id: string | null;
  at: string;
};

export type BookingDetailResult = BookingSummary & {
  experience: {
    id: string;
    title: string;
  };
  slot: {
    id: string;
    starts_at: string;
    ends_at: string;
  };
  timeline: BookingTimelineEntry[];
};
