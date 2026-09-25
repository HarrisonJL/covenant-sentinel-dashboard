import { describe, expect, it } from "vitest";
import { bindPeriodFromDelta, findBoundPeriod } from "@/lib/bindPeriod";
import type { Period } from "@/lib/useCovenantState";

function makePeriod(overrides: Partial<Period> = {}): Period {
  return {
    period_id: 3,
    disclosure_text: "Q1 2026 disclosure",
    disclosure_url: "",
    extracted_json: '{"dscr": 15000}',
    per_covenant_json: '{"min_dscr": "PASS"}',
    content_hash: "deadbeef",
    verdict: "PASS",
    submitted_by: "0x0000000000000000000000000000000000000000",
    submitted_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("findBoundPeriod", () => {
  it("matches on period_id", () => {
    const mine = makePeriod({ period_id: 3 });
    const found = findBoundPeriod([mine], 3);
    expect(found).toBe(mine);
  });

  it("does not match a record with a different period_id", () => {
    const other = makePeriod({ period_id: 4 });
    const found = findBoundPeriod([other], 3);
    expect(found).toBeNull();
  });
});

describe("bindPeriodFromDelta", () => {
  it("binds to the correct record by period_id", () => {
    const mine = makePeriod({ period_id: 3, verdict: "FAIL" });
    const result = bindPeriodFromDelta(2, 3, [mine], 3);
    expect(result).toEqual({ kind: "bound", period: mine });
  });

  it("reports no_new_record when period_count never increased (validator timeout / stranded bookkeeping)", () => {
    // The transaction reached a decided consensus status, but
    // submit_disclosure's own bookkeeping never ran, so period_count is
    // unchanged. Must not fall back to showing whatever the pre-existing
    // "latest" period was - that would display a stale, unrelated
    // disclosure as if it were the result of this failed submission.
    const result = bindPeriodFromDelta(2, 2, [makePeriod()], 3);
    expect(result).toEqual({ kind: "no_new_record" });
  });

  it("reports no_new_record when the count went backwards", () => {
    const result = bindPeriodFromDelta(2, 1, [], 3);
    expect(result).toEqual({ kind: "no_new_record" });
  });

  it("only searches within the delta window, not the whole history", () => {
    // An older period with a coincidentally-matching period_id further back
    // in the array must not be picked up - only records within the actual
    // count delta are real candidates.
    const stale = makePeriod({ period_id: 3 }); // matches, but outside the delta
    const result = bindPeriodFromDelta(2, 3, [stale], 5);
    expect(result).toEqual({ kind: "unmatched" });
  });

  it("reports unmatched when the count increased but nothing in the delta window matches", () => {
    const unrelated = makePeriod({ period_id: 99 });
    const result = bindPeriodFromDelta(2, 3, [unrelated], 3);
    expect(result).toEqual({ kind: "unmatched" });
  });
});
