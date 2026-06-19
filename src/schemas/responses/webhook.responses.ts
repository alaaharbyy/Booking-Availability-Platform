export type WebhookRegistrationResult = {
  id: string;
  url: string;
  secret: string;
  active: boolean;
  created_at: string;
  created: boolean;
};

export type WebhookTestResult = {
  delivered: boolean;
  status_code?: number;
  error?: string;
  duration_ms: number;
};
