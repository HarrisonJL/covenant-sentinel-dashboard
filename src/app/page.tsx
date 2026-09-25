"use client";

import { useCallback, useEffect, useState } from "react";
import { CONTRACT_ADDRESS, chain } from "@/lib/genlayer";
import {
  useFacilityState,
  fetchCovenants,
  fetchPeriods,
  fetchPeriod,
  fetchWaivers,
  fetchAuditLog,
  isConfigured,
  type Covenant,
  type Period,
  type Waiver,
  type AuditEvent,
} from "@/lib/useCovenantState";
import { truncateAddress, timeAgo, formatSeconds, deadlinePassed } from "@/lib/format";
import { Card, StatCard, StatusBadge } from "@/components/ui";
import CovenantsList from "@/components/CovenantsList";
import PeriodsTable from "@/components/PeriodsTable";
import AddCovenantForm from "@/components/AddCovenantForm";
import SubmitDisclosureForm from "@/components/SubmitDisclosureForm";
import FlagReportingDefaultButton from "@/components/FlagReportingDefaultButton";
import WaiversPanel from "@/components/WaiversPanel";

export default function Home() {
  const { state, error, loading, refresh } = useFacilityState();
  const [covenants, setCovenants] = useState<Covenant[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [waivers, setWaivers] = useState<Waiver[]>([]);
  const [activeBreachPeriod, setActiveBreachPeriod] = useState<Period | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);

  const refreshDetail = useCallback(async () => {
    if (!isConfigured()) return;
    const [c, p, w, log] = await Promise.all([
      fetchCovenants(),
      fetchPeriods(0, 20),
      fetchWaivers(0, 20),
      fetchAuditLog(0, 20),
    ]);
    setCovenants(c);
    setPeriods(p);
    setWaivers(w);
    setAuditLog(log);
  }, []);

  // active_breach_period_id's own record needs a separate fetch (it isn't
  // necessarily among the 20 most recent periods) - only fetched when
  // there's actually an active breach to look up, and cleared otherwise so
  // a stale breach period doesn't linger in the UI after a cure.
  useEffect(() => {
    if (!state || state.active_breach_period_id === 0) {
      setActiveBreachPeriod(null);
      return;
    }
    fetchPeriod(state.active_breach_period_id).then(setActiveBreachPeriod).catch(() => setActiveBreachPeriod(null));
  }, [state?.active_breach_period_id]);

  useEffect(() => {
    refreshDetail();
  }, [refreshDetail, state?.covenant_count, state?.period_count, state?.waiver_count]);

  const refreshAll = useCallback(() => {
    refresh();
    refreshDetail();
  }, [refresh, refreshDetail]);

  if (!isConfigured()) {
    return (
      <Card>
        <p className="text-sm text-[color:var(--breach)]">NEXT_PUBLIC_CONTRACT_ADDRESS is not set.</p>
      </Card>
    );
  }

  if (loading) {
    return <p className="text-sm text-[color:var(--muted)]">Loading facility state...</p>;
  }

  if (error || !state) {
    return (
      <Card>
        <p className="text-sm text-[color:var(--breach)]">{error ?? "Failed to load facility state."}</p>
      </Card>
    );
  }

  // last_period_id only ever increases (the contract asserts
  // period_id > last_period_id) but periods aren't required to be
  // contiguous, so it can diverge from period_count. Always derive the
  // next id from last_period_id, never from the submission count.
  const nextPeriodId = state.last_period_id + 1;
  const deadlineLikelyPassed = deadlinePassed(state.last_report_time, state.reporting_deadline_seconds);
  const canSubmitDisclosure = state.status === "current" || state.status === "waived";
  const latestPassingPeriod = periods.find(
    (p) => p.verdict === "PASS" && p.period_id > state.active_breach_period_id
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center gap-3">
          <h1 className="text-xl font-semibold">Facility {truncateAddress(CONTRACT_ADDRESS)}</h1>
          <StatusBadge status={state.status} />
        </div>
        <p className="text-sm text-[color:var(--muted)]">
          A lender defines the covenants; each period the borrower submits a disclosure (pasted or fetched live
          from a URL), and every validator independently extracts the figures and reaches consensus on
          Pass/Fail/Inconclusive before the compliance check runs.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Owner (lender)" value={truncateAddress(state.owner)} />
        <StatCard label="Borrower" value={truncateAddress(state.borrower)} />
        <StatCard label="Covenants" value={String(state.covenant_count)} />
        <StatCard label="Periods reported" value={String(state.period_count)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Reporting deadline" value={formatSeconds(state.reporting_deadline_seconds)} hint="max gap between disclosures" />
        <StatCard label="Last report" value={timeAgo(state.last_report_time)} />
        <StatCard label="Waivers" value={String(state.waiver_count)} />
      </div>

      <Card title="Covenants" subtitle={`chain ${chain.id}`}>
        <CovenantsList covenants={covenants} />
      </Card>

      {state.status === "current" && (
        <Card title="Add a covenant" subtitle="owner only">
          <AddCovenantForm onSettled={refreshAll} />
        </Card>
      )}

      {canSubmitDisclosure && (
        <Card title="Submit a disclosure" subtitle="borrower only">
          <SubmitDisclosureForm periodId={nextPeriodId} onSettled={refreshAll} />
        </Card>
      )}

      {(state.status === "breach" || state.status === "waived" || waivers.length > 0) && (
        <Card
          title="Waivers"
          subtitle={state.status === "breach" ? "borrower requests, lender decides" : state.status === "waived" ? "cure with a later passing period" : undefined}
        >
          <WaiversPanel
            state={state}
            waivers={waivers}
            activeBreachPeriod={activeBreachPeriod}
            latestPassingPeriodId={latestPassingPeriod?.period_id ?? null}
            onSettled={refreshAll}
          />
        </Card>
      )}

      {state.status === "current" && (
        <Card title="Flag reporting default" subtitle="anyone can call this">
          <FlagReportingDefaultButton deadlineLikelyPassed={deadlineLikelyPassed} onSettled={refreshAll} />
        </Card>
      )}

      <Card title="Period history">
        <PeriodsTable periods={periods} />
      </Card>

      <Card title="Audit log" subtitle="append-only, every state transition">
        {auditLog.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No events yet.</p>
        ) : (
          <div className="space-y-2">
            {auditLog.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="mono text-[color:var(--foreground)]">
                  {e.event_type}
                  {e.period_id > 0 ? ` (period ${e.period_id})` : ""}
                  {e.covenant_name ? ` / ${e.covenant_name}` : ""}
                  {e.detail ? ` - ${e.detail}` : ""}
                </span>
                <span className="whitespace-nowrap text-[color:var(--muted)]">{timeAgo(e.at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
