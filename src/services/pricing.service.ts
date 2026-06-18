import { type Prisma, PricingRuleType } from "../generated/prisma/client.js";
import type {
  PricingAdjustment,
  PricingPreview,
} from "../schemas/responses/pricing.responses.js";
import {
  advanceBookingConfigSchema,
  groupSizeConfigSchema,
  seasonalConfigSchema,
} from "../schemas/responses/pricing.responses.js";

export type { PricingAdjustment, PricingPreview };

export type PricingRuleConfig = {
  ruleType: PricingRuleType;
  config: unknown;
};

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function formatMoney(amount: number): string {
  return amount.toFixed(2);
}

export function calculatePricingPreview(
  basePrice: Prisma.Decimal,
  partySize: number,
  rules: PricingRuleConfig[],
  slotStartsAt?: Date,
): PricingPreview {
  const basePricePerPerson = decimalToNumber(basePrice);
  let runningTotal = basePricePerPerson * partySize;
  const subtotal = runningTotal;
  const adjustments: PricingAdjustment[] = [];

  for (const rule of rules) {
    switch (rule.ruleType) {
      case PricingRuleType.GROUP_SIZE: {
        const parsed = groupSizeConfigSchema.safeParse(rule.config);
        if (!parsed.success) {
          break;
        }

        const config = parsed.data;
        if (partySize < config.minPartySize) {
          break;
        }

        const amount = runningTotal * (config.discountPercent / 100);
        runningTotal -= amount;
        adjustments.push({
          ruleType: rule.ruleType,
          description: `Group size discount (${config.discountPercent}% off for ${config.minPartySize}+ guests)`,
          percent: config.discountPercent,
          amount: formatMoney(-amount),
        });
        break;
      }

      case PricingRuleType.ADVANCE_BOOKING: {
        const parsed = advanceBookingConfigSchema.safeParse(rule.config);
        if (!parsed.success || !slotStartsAt) {
          break;
        }

        const config = parsed.data;
        const daysUntilSlot = Math.floor(
          (slotStartsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );

        if (daysUntilSlot < config.daysInAdvance) {
          break;
        }

        const amount = runningTotal * (config.discountPercent / 100);
        runningTotal -= amount;
        adjustments.push({
          ruleType: rule.ruleType,
          description: `Advance booking discount (${config.discountPercent}% off for ${config.daysInAdvance}+ days ahead)`,
          percent: config.discountPercent,
          amount: formatMoney(-amount),
        });
        break;
      }

      case PricingRuleType.SEASONAL: {
        const parsed = seasonalConfigSchema.safeParse(rule.config);
        if (!parsed.success || !slotStartsAt) {
          break;
        }

        const config = parsed.data;
        const month = slotStartsAt.getUTCMonth() + 1;
        if (!config.months.includes(month)) {
          break;
        }

        const amount = runningTotal * (config.surchargePercent / 100);
        runningTotal += amount;
        adjustments.push({
          ruleType: rule.ruleType,
          description: `Seasonal surcharge (${config.surchargePercent}% ${config.season} rate)`,
          percent: config.surchargePercent,
          amount: formatMoney(amount),
        });
        break;
      }
    }
  }

  return {
    partySize,
    basePricePerPerson: formatMoney(basePricePerPerson),
    subtotal: formatMoney(subtotal),
    adjustments,
    totalPrice: formatMoney(runningTotal),
  };
}
