import { z } from "zod";

export const registerWebhookBodySchema = z.object({
  url: z.url("Must be a valid URL"),
});

export const testWebhookBodySchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
});

export type RegisterWebhookBody = z.infer<typeof registerWebhookBodySchema>;
export type TestWebhookBody = z.infer<typeof testWebhookBodySchema>;
