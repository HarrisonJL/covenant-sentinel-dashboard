import { fetchFacilityState, fetchPeriods, type Period } from "@/lib/useCovenantState";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type BindResult =
  | { kind: "bound"; period: Period }
  // period_count never increased past beforeCount - the transaction reached
  // a decided consensus status, but submit_disclosure's own bookkeeping
  // never ran (e.g. a validator timeout stranding the call before it could
  // append a record). There is no period to bind, and none should be shown.
  | { kind: "no_new_record" }
  // period_count increased but none of the newly-appended records match the
  // period_id we submitted - shouldn't happen for a correctly-submitted
  // disclosure, but fails safe rather than falling back to "latest".
  | { kind: "unmatched" };

// Matches by period_id against only the records appended since this
// submission started (newPeriodsNewestFirst), never against the whole
// history - "latest period" is not the same thing as "the period we just
// submitted", and conflating them is exactly the bug this guards against: a
// stale, previously-recorded disclosure must never be displayed as the
// result of a failed or in-flight submission.
export function findBoundPeriod(newPeriodsNewestFirst: Period[], periodId: number): Period | null {
  return newPeriodsNewestFirst.find((p) => p.period_id === periodId) ?? null;
}

export function bindPeriodFromDelta(
  beforeCount: number,
  afterCount: number,
  recentPeriodsNewestFirst: Period[],
  periodId: number
): BindResult {
  const delta = afterCount - beforeCount;
  if (delta <= 0) return { kind: "no_new_record" };
  const candidates = recentPeriodsNewestFirst.slice(0, delta);
  const match = findBoundPeriod(candidates, periodId);
  return match ? { kind: "bound", period: match } : { kind: "unmatched" };
}

// Real I/O wrapper around bindPeriodFromDelta - retries briefly for read-
// node lag (get_periods(0, N) right after a just-accepted write can be a
// beat behind), but never falls back to "just show whatever's newest".
export async function resolveBoundPeriod(
  beforeCount: number,
  periodId: number,
  retries = 4,
  retryDelayMs = 1500
): Promise<BindResult> {
  for (let i = 0; i < retries; i++) {
    const state = await fetchFacilityState();
    const afterCount = state.period_count;
    if (afterCount > beforeCount) {
      const recent = await fetchPeriods(0, afterCount - beforeCount);
      return bindPeriodFromDelta(beforeCount, afterCount, recent, periodId);
    }
    if (i < retries - 1) await sleep(retryDelayMs);
  }
  return { kind: "no_new_record" };
}
