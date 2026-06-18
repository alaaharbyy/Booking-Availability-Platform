import type { PricingRuleType } from "../../generated/prisma/client.js";
import { z } from "zod";

export type PricingAdjustment = {
  ruleType: PricingRuleType;
  description: string;
  percent: number;
  amount: string;
};

export type PricingPreview = {
  partySize: number;
  basePricePerPerson: string;
  subtotal: string;
  adjustments: PricingAdjustment[];
  totalPrice: string;
};



// Pricing Rule Config Schemas for json unmarshalling

export const groupSizeConfigSchema = z.object({
  minPartySize: z.number().int().min(1),
  discountPercent: z.number().min(0).max(100),
});

export const advanceBookingConfigSchema = z.object({
  daysInAdvance: z.number().int().min(0),
  discountPercent: z.number().min(0).max(100),
});

export const seasonalConfigSchema = z.object({
  season: z.string().min(1),
  months: z.array(z.number().int().min(1).max(12)).min(1),
  surchargePercent: z.number().min(0),
});

export type GroupSizeConfig = z.infer<typeof groupSizeConfigSchema>;
export type AdvanceBookingConfig = z.infer<typeof advanceBookingConfigSchema>;
export type SeasonalConfig = z.infer<typeof seasonalConfigSchema>;
