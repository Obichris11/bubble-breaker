/** `1234` → `"1,234"` (the design formats every number with en-US grouping). */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/** Elapsed milliseconds as `m:ss`; minutes are not capped (`75:03`). */
export function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}
