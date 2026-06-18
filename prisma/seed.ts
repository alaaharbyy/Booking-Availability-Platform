import "dotenv/config";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AuditEventType,
  BookingStatus,
  PrismaClient,
  PricingRuleType,
  UserRole,
} from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function daysFromNow(days: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function clearDatabase() {
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.availabilitySlot.deleteMany();
  await prisma.pricingRule.deleteMany();
  await prisma.experience.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.refreshTokenFamily.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.tenantWebhook.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.tenant.deleteMany();
}

async function main() {
  const passwordHash = await bcrypt.hash("Password123!", 10);

  console.log("Clearing existing data...");
  await clearDatabase();

  console.log("Creating tenants...");
  const summit = await prisma.tenant.create({
    data: { name: "Summit Adventures", slug: "summit-adventures" },
  });

  const coastal = await prisma.tenant.create({
    data: { name: "Coastal Escapes", slug: "coastal-escapes" },
  });

  console.log("Creating users...");
  const summitAdmin = await prisma.user.create({
    data: {
      tenantId: summit.id,
      email: "admin@summit-adventures.com",
      passwordHash: passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const summitManager = await prisma.user.create({
    data: {
      tenantId: summit.id,
      email: "manager@summit-adventures.com",
      passwordHash: passwordHash,
      role: UserRole.TRAVEL_MANAGER,
    },
  });

  const summitViewer = await prisma.user.create({
    data: {
      tenantId: summit.id,
      email: "viewer@summit-adventures.com",
      passwordHash: passwordHash,
      role: UserRole.VIEWER,
    },
  });

  const coastalAdmin = await prisma.user.create({
    data: {
      tenantId: coastal.id,
      email: "admin@coastal-escapes.com",
      passwordHash: passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const coastalManager = await prisma.user.create({
    data: {
      tenantId: coastal.id,
      email: "manager@coastal-escapes.com",
      passwordHash: passwordHash,
      role: UserRole.TRAVEL_MANAGER,
    },
  });

  console.log("Creating suppliers...");
  const alpineGuides = await prisma.supplier.create({
    data: {
      tenantId: summit.id,
      name: "Alpine Guides Co.",
      email: "ops@alpineguides.com",
    },
  });

  const peakExpeditions = await prisma.supplier.create({
    data: {
      tenantId: summit.id,
      name: "Peak Expeditions",
      email: "bookings@peakexpeditions.com",
    },
  });

  const oceanBlue = await prisma.supplier.create({
    data: {
      tenantId: coastal.id,
      name: "Ocean Blue Tours",
      email: "hello@oceanblue.com",
    },
  });

  const vineyardWalks = await prisma.supplier.create({
    data: {
      tenantId: coastal.id,
      name: "Vineyard Walks",
      email: "tours@vineyardwalks.com",
    },
  });

  console.log("Creating experiences...");
  const glacierHike = await prisma.experience.create({
    data: {
      tenantId: summit.id,
      supplierId: alpineGuides.id,
      title: "Glacier Hike & Ice Caves",
      destination: "Chamonix, France",
      description:
        "Guided glacier trek with crampons, ice cave exploration, and mountain safety briefing.",
      basePrice: 189.0,
      capacity: 12,
    },
  });

  const summitTrek = await prisma.experience.create({
    data: {
      tenantId: summit.id,
      supplierId: peakExpeditions.id,
      title: "Mont Blanc Sunrise Trek",
      destination: "Courmayeur, Italy",
      description:
        "Early-morning alpine trek with panoramic views and a mountain breakfast stop.",
      basePrice: 245.0,
      capacity: 8,
    },
  });

  const kayakTour = await prisma.experience.create({
    data: {
      tenantId: coastal.id,
      supplierId: oceanBlue.id,
      title: "Sea Kayak & Snorkel Safari",
      destination: "Amalfi Coast, Italy",
      description:
        "Half-day kayak along the coastline with guided snorkelling in hidden coves.",
      basePrice: 120.0,
      capacity: 16,
    },
  });

  const wineTour = await prisma.experience.create({
    data: {
      tenantId: coastal.id,
      supplierId: vineyardWalks.id,
      title: "Tuscan Vineyard & Tasting",
      destination: "Chianti, Italy",
      description:
        "Vineyard walk, cellar tour, and guided tasting of four regional wines with local cheese.",
      basePrice: 95.0,
      capacity: 20,
    },
  });

  console.log("Creating pricing rules...");
  await prisma.pricingRule.createMany({
    data: [
      {
        supplierId: alpineGuides.id,
        ruleType: PricingRuleType.GROUP_SIZE,
        config: { minPartySize: 6, discountPercent: 10 },
      },
      {
        supplierId: peakExpeditions.id,
        ruleType: PricingRuleType.ADVANCE_BOOKING,
        config: { daysInAdvance: 30, discountPercent: 15 },
      },
      {
        supplierId: oceanBlue.id,
        ruleType: PricingRuleType.SEASONAL,
        config: { season: "summer", months: [6, 7, 8], surchargePercent: 20 },
      },
      {
        supplierId: vineyardWalks.id,
        ruleType: PricingRuleType.GROUP_SIZE,
        config: { minPartySize: 8, discountPercent: 12 },
      },
    ],
  });

  console.log("Creating availability slots...");
  const glacierSlot1 = await prisma.availabilitySlot.create({
    data: {
      tenantId: summit.id,
      experienceId: glacierHike.id,
      startsAt: daysFromNow(7, 8),
      endsAt: daysFromNow(7, 13),
      capacity: 12,
      reserved: 4,
    },
  });

  const glacierSlot2 = await prisma.availabilitySlot.create({
    data: {
      tenantId: summit.id,
      experienceId: glacierHike.id,
      startsAt: daysFromNow(14, 8),
      endsAt: daysFromNow(14, 13),
      capacity: 12,
      reserved: 0,
    },
  });

  const trekSlot = await prisma.availabilitySlot.create({
    data: {
      tenantId: summit.id,
      experienceId: summitTrek.id,
      startsAt: daysFromNow(10, 5),
      endsAt: daysFromNow(10, 12),
      capacity: 8,
      reserved: 2,
    },
  });

  const kayakSlot = await prisma.availabilitySlot.create({
    data: {
      tenantId: coastal.id,
      experienceId: kayakTour.id,
      startsAt: daysFromNow(5, 9),
      endsAt: daysFromNow(5, 13),
      capacity: 16,
      reserved: 6,
    },
  });

  const wineSlot = await prisma.availabilitySlot.create({
    data: {
      tenantId: coastal.id,
      experienceId: wineTour.id,
      startsAt: daysFromNow(12, 14),
      endsAt: daysFromNow(12, 17),
      capacity: 20,
      reserved: 10,
    },
  });

  console.log("Creating bookings...");
  const confirmedBooking = await prisma.booking.create({
    data: {
      reference: "BK-CONFIRM1",
      tenantId: summit.id,
      userId: summitViewer.id,
      experienceId: glacierHike.id,
      slotId: glacierSlot1.id,
      partySize: 4,
      totalPrice: 756.0,
      status: BookingStatus.CONFIRMED,
    },
  });

  const reservedBooking = await prisma.booking.create({
    data: {
      reference: "BK-RESERVED",
      tenantId: summit.id,
      userId: summitManager.id,
      experienceId: summitTrek.id,
      slotId: trekSlot.id,
      partySize: 2,
      totalPrice: 490.0,
      status: BookingStatus.RESERVED,
      reservedUntil: daysFromNow(1, 23),
    },
  });

  const cancelledBooking = await prisma.booking.create({
    data: {
      reference: "BK-CANCEL1",
      tenantId: coastal.id,
      userId: coastalManager.id,
      experienceId: kayakTour.id,
      slotId: kayakSlot.id,
      partySize: 3,
      totalPrice: 360.0,
      status: BookingStatus.CANCELLED,
    },
  });

  const expiredBooking = await prisma.booking.create({
    data: {
      reference: "BK-EXPIRED1",
      tenantId: coastal.id,
      userId: coastalAdmin.id,
      experienceId: wineTour.id,
      slotId: wineSlot.id,
      partySize: 2,
      totalPrice: 190.0,
      status: BookingStatus.EXPIRED,
      reservedUntil: daysFromNow(-2),
    },
  });

  console.log("Creating booking status history...");
  await prisma.bookingStatusHistory.createMany({
    data: [
      {
        bookingId: confirmedBooking.id,
        fromStatus: null,
        toStatus: BookingStatus.RESERVED,
        actorUserId: summitViewer.id,
      },
      {
        bookingId: confirmedBooking.id,
        fromStatus: BookingStatus.RESERVED,
        toStatus: BookingStatus.CONFIRMED,
        actorUserId: summitManager.id,
      },
      {
        bookingId: reservedBooking.id,
        fromStatus: null,
        toStatus: BookingStatus.RESERVED,
        actorUserId: summitManager.id,
      },
      {
        bookingId: cancelledBooking.id,
        fromStatus: null,
        toStatus: BookingStatus.RESERVED,
        actorUserId: coastalManager.id,
      },
      {
        bookingId: cancelledBooking.id,
        fromStatus: BookingStatus.RESERVED,
        toStatus: BookingStatus.CANCELLED,
        actorUserId: coastalAdmin.id,
        reason: "Customer requested cancellation",
      },
      {
        bookingId: expiredBooking.id,
        fromStatus: null,
        toStatus: BookingStatus.RESERVED,
        actorUserId: coastalAdmin.id,
      },
      {
        bookingId: expiredBooking.id,
        fromStatus: BookingStatus.RESERVED,
        toStatus: BookingStatus.EXPIRED,
      },
    ],
  });

  console.log("Creating webhooks...");
  await prisma.tenantWebhook.createMany({
    data: [
      {
        tenantId: summit.id,
        url: "https://hooks.summit-adventures.com/bookings",
        secret: "whsec_summit_dev_secret",
        active: true,
      },
      {
        tenantId: coastal.id,
        url: "https://api.coastal-escapes.com/webhooks/bookings",
        secret: "whsec_coastal_dev_secret",
        active: true,
      },
    ],
  });

  console.log("Creating refresh tokens...");
  const tokenFamily = await prisma.refreshTokenFamily.create({
    data: { userId: summitAdmin.id },
  });

  await prisma.refreshToken.create({
    data: {
      familyId: tokenFamily.id,
      tokenHash: hashToken("dev-refresh-token-summit-admin"),
      expiresAt: daysFromNow(30),
    },
  });

  console.log("Creating audit logs...");
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: summit.id,
        actorUserId: summitAdmin.id,
        eventType: AuditEventType.USER_CREATED,
        entityType: "User",
        entityId: summitViewer.id,
        metadata: { email: "viewer@summit-adventures.com", role: "VIEWER" },
      },
      {
        tenantId: summit.id,
        actorUserId: summitManager.id,
        eventType: AuditEventType.BOOKING_CONFIRMED,
        entityType: "Booking",
        entityId: confirmedBooking.id,
        metadata: { partySize: 4, totalPrice: 756.0 },
      },
      {
        tenantId: coastal.id,
        actorUserId: coastalAdmin.id,
        eventType: AuditEventType.WEBHOOK_CREATED,
        entityType: "TenantWebhook",
        metadata: { url: "https://api.coastal-escapes.com/webhooks/bookings" },
      },
      {
        tenantId: summit.id,
        actorUserId: summitAdmin.id,
        eventType: AuditEventType.PRICING_RULE_CREATED,
        entityType: "PricingRule",
        metadata: { ruleType: "GROUP_SIZE", discountPercent: 10 },
      },
      {
        tenantId: coastal.id,
        actorUserId: coastalManager.id,
        eventType: AuditEventType.BOOKING_CANCELLED,
        entityType: "Booking",
        entityId: cancelledBooking.id,
        metadata: { reason: "Customer requested cancellation" },
      },
    ],
  });

  console.log("Creating outbox events...");
  await prisma.outboxEvent.createMany({
    data: [
      {
        eventType: "booking.confirmed",
        payload: {
          bookingId: confirmedBooking.id,
          tenantId: summit.id,
          experienceTitle: glacierHike.title,
        },
        processed: true,
      },
      {
        eventType: "booking.reserved",
        payload: {
          bookingId: reservedBooking.id,
          tenantId: summit.id,
          reservedUntil: reservedBooking.reservedUntil,
        },
        processed: false,
      },
      {
        eventType: "booking.cancelled",
        payload: {
          bookingId: cancelledBooking.id,
          tenantId: coastal.id,
        },
        processed: false,
      },
    ],
  });

  console.log("\nSeed complete.");
  console.log("─────────────────────────────────────────");
  console.log("Tenants:      2 (Summit Adventures, Coastal Escapes)");
  console.log("Users:        5 (password for all: Password123!)");
  console.log("Suppliers:    4");
  console.log("Experiences:  4");
  console.log("Slots:        5");
  console.log("Bookings:     4 (CONFIRMED, RESERVED, CANCELLED, EXPIRED)");
  console.log("─────────────────────────────────────────");
  console.log("Sample logins:");
  console.log("  admin@summit-adventures.com");
  console.log("  manager@coastal-escapes.com");
  console.log("  viewer@summit-adventures.com");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
