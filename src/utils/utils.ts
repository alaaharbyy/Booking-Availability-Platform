export function parseUtcDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function endDateExclusive(date: string): Date {
  const end = parseUtcDate(date);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

export function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function defaultSearchStartDate(): string {
  return formatUtcDate(new Date());
}

export function defaultSearchEndDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 90);
  return formatUtcDate(date);
}
