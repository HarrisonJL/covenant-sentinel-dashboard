"use client";

import { useCallback, useEffect, useState } from "react";
import { CONTRACT_ADDRESS, getReadClient } from "@/lib/genlayer";

export type FacilityState = {
  owner: string;
  borrower: string;
  status: "current" | "breach" | "waived" | "reporting_default";
  covenant_count: number;
  period_count: number;
  waiver_count: number;
  audit_log_count: number;
  reporting_deadline_seconds: number;
  last_report_time: string;
  // last_period_id only ever increases (submit_disclosure/submit_disclosure_url
  // assert period_id > last_period_id) but isn't guaranteed to equal
  // period_count - periods aren't required to be contiguous. Always derive
  // the next period_id to submit from this field, never from period_count.
  last_period_id: number;
  // 0 when the facility isn't currently in an active breach.
  active_breach_period_id: number;
};

export type Covenant = {
  name: string;
  metric: string;
  comparison: "gte" | "lte";
  threshold_bps: bigint;
  tolerance_bps: number;
};

export type Verdict = "PASS" | "FAIL" | "INCONCLUSIVE";

export type Period = {
  period_id: number;
  disclosure_text: string; // "" when submitted via submit_disclosure_url
  disclosure_url: string; // "" when submitted as direct text
  extracted_json: string;
  per_covenant_json: string;
  content_hash: string; // evidence only, not a consensus input - see README
  verdict: Verdict;
  submitted_by: string;
  submitted_at: string;
};

export type WaiverStatus = "pending" | "granted" | "rejected";

export type Waiver = {
  period_id: number;
  covenant_name: string;
  rationale: string;
  status: WaiverStatus;
  requested_by: string;
  requested_at: string;
  decided_by: string; // "" while pending
  decided_at: string; // "" while pending
  decision_note: string;
};

export type AuditEvent = {
  event_type: string;
  period_id: number;
  covenant_name: string;
  detail: string;
  actor: string;
  at: string;
};

export function isConfigured(): boolean {
  return CONTRACT_ADDRESS.length > 0;
}

// Standalone (not just the hook's internal refresh) so bindPeriod.ts's
// count-delta check can read a fresh period_count without going through
// React state.
export async function fetchFacilityState(): Promise<FacilityState> {
  const client = getReadClient();
  return (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "get_state",
    args: [],
  })) as FacilityState;
}

// No automatic interval polling - Studio Next's public RPC caps at both 30
// requests/minute AND 500/hour, shared across every visitor, not per-user
// (confirmed live and already documented in the sibling PegWatch project's
// incident). This app only needs fresh state on load and after the current
// user's own actions (already wired via onSettled everywhere below), not a
// live feed of everyone else's activity. Loads once; call `refresh()` for
// a manual retry/refresh.
export function useFacilityState() {
  const [state, setState] = useState<FacilityState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isConfigured()) {
      setError("NEXT_PUBLIC_CONTRACT_ADDRESS is not set.");
      setLoading(false);
      return;
    }
    try {
      setState(await fetchFacilityState());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read facility state.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { state, error, loading, refresh };
}

// u256/u32 fields come back over JSON-RPC as decimal strings, not native
// bigints (confirmed the hard way in the sibling genlayer-vault project -
// a wallet's value.toString(16) silently reinterprets a decimal string as
// hex if this conversion is skipped). Convert explicitly at this boundary.
export async function fetchCovenants(): Promise<Covenant[]> {
  const client = getReadClient();
  const raw = (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "get_covenants",
    args: [],
  })) as Record<string, unknown>[];
  return raw.map((c) => ({
    ...c,
    threshold_bps: BigInt(c.threshold_bps as string | number | bigint),
  })) as Covenant[];
}

export async function fetchPeriods(offset: number, limit: number): Promise<Period[]> {
  const client = getReadClient();
  return (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "get_periods",
    args: [offset, limit],
  })) as Period[];
}

export async function fetchPeriod(periodId: number): Promise<Period> {
  const client = getReadClient();
  return (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "get_period",
    args: [periodId],
  })) as Period;
}

export async function fetchWaivers(offset: number, limit: number): Promise<Waiver[]> {
  const client = getReadClient();
  return (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "get_waivers",
    args: [offset, limit],
  })) as Waiver[];
}

export async function fetchAuditLog(offset: number, limit: number): Promise<AuditEvent[]> {
  const client = getReadClient();
  return (await client.readContract({
    address: CONTRACT_ADDRESS as `0x${string}`,
    functionName: "get_audit_log",
    args: [offset, limit],
  })) as AuditEvent[];
}
