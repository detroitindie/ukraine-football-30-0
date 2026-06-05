export function cleanPlayerName(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "Unknown player";
  }

  return value.trim().replace(/\s+\(\d+\)$/, "");
}

export function safePlayerText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function safePlayerStat(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
