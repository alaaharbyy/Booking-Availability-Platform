import type { PaginationMeta } from "./pagination.responses.js";
import type { PricingPreview } from "./pricing.responses.js";

export type ExperienceSearchItem = {
  id: string;
  title: string;
  destination: string;
  description: string | null;
  basePrice: string;
  capacity: number;
  supplier: {
    id: string;
    name: string;
  };
  partySize: number;
  fromPrice: string;
  availableSlots: number;
  earliestSlotAt: string | null;
};

export type ExperienceSearchResult = {
  items: ExperienceSearchItem[];
  pagination: PaginationMeta;
};

export type ExperienceSlotPreview = {
  slotId: string;
  startsAt: string;
  endsAt: string;
  slotCapacity: number;
  reserved: number;
  availableSpots: number;
  pricingPreview: PricingPreview;
};

export type ExperienceDetailResult = {
  id: string;
  title: string;
  destination: string;
  description: string | null;
  basePrice: string;
  capacity: number;
  supplier: {
    id: string;
    name: string;
    email: string | null;
  };
  partySize: number;
  pricingPreview: PricingPreview;
  slots: ExperienceSlotPreview[];
};
