export const AuditEntityType = {
  Tenant: "Tenant",
  User: "User",
  Supplier: "Supplier",
  Experience: "Experience",
  AvailabilitySlot: "AvailabilitySlot",
  PricingRule: "PricingRule",
  Booking: "Booking",
  TenantWebhook: "TenantWebhook",
} as const;

export type AuditEntityType =
  (typeof AuditEntityType)[keyof typeof AuditEntityType];
