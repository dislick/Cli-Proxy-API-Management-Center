/**
 * Per-credential Codex quota reserve (`quota_reserve_percent`). CPA stops routing to the
 * credential once any current usage window reaches `100 - reserve` percent used.
 * Missing, null and 0 disable the reserve.
 */
export const MIN_QUOTA_RESERVE_PERCENT = 0;
export const MAX_QUOTA_RESERVE_PERCENT = 100;

const NUMBER_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;

const parseNumberText = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed || !NUMBER_PATTERN.test(trimmed)) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const inRange = (value: number): boolean =>
  value >= MIN_QUOTA_RESERVE_PERCENT && value <= MAX_QUOTA_RESERVE_PERCENT;

/** Reads a stored reserve; returns undefined when absent, invalid or disabled (0). */
export const readQuotaReservePercent = (value: unknown): number | undefined => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? parseNumberText(value)
        : undefined;
  if (parsed === undefined || !Number.isFinite(parsed) || !inRange(parsed) || parsed === 0) {
    return undefined;
  }
  return parsed;
};

/** Returns true when editor text is empty or a number from 0 to 100. */
export const isValidQuotaReserveText = (value: string): boolean => {
  if (!value.trim()) return true;
  const parsed = parseNumberText(value);
  return parsed !== undefined && inRange(parsed);
};

/** Parses editor text; empty and 0 both mean "disabled" and return undefined. */
export const parseQuotaReserveText = (value: string): number | undefined => {
  if (!isValidQuotaReserveText(value)) return undefined;
  const parsed = parseNumberText(value);
  return parsed === undefined || parsed === 0 ? undefined : parsed;
};
