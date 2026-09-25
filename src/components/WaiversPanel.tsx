"use client";

import { useRef, useState } from "react";
import { CONTRACT_ADDRESS, getWriteClient } from "@/lib/genlayer";
import { useWallet } from "@/lib/useWallet";
import { pollTransaction, describeFailure, STATUS_COPY, type Progress } from "@/lib/pollTransaction";
import { timeAgo } from "@/lib/format";
import { Button, Field, inputClass, WaiverStatusBadge } from "@/components/ui";
import type { FacilityState, Period, Waiver } from "@/lib/useCovenantState";

const ACCEPTED = "5";
const MAX_RATIONALE_LEN = 1000;
const MAX_NOTE_LEN = 1000;

function useWaiverAction(account: `0x${string}` | null) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cancelledRef = useRef(false);

  async function run(fn: (client: ReturnType<typeof getWriteClient>) => Promise<`0x${string}`>, rejectionHint: string) {
    if (!account) return false;
    setSubmitting(true);
    setError(null);
    cancelledRef.current = false;
    try {
      const client = getWriteClient(account);
      const txHash = await fn(client);
      const tx = await pollTransaction(client, txHash, "ACCEPTED", setProgress, () => cancelledRef.current);
      const statusNum = String(tx.status);
      if (statusNum !== ACCEPTED) {
        setError(describeFailure(tx, rejectionHint));
        return false;
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed.");
      return false;
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return { run, progress, error, submitting };
}

function RequestWaiverForm({
  activeBreachPeriod,
  onSettled,
}: {
  activeBreachPeriod: Period;
  onSettled: () => void;
}) {
  const { account, connecting, error: walletError, connect } = useWallet();
  const [covenantName, setCovenantName] = useState("");
  const [rationale, setRationale] = useState("");
  const [done, setDone] = useState(false);
  const { run, progress, error, submitting } = useWaiverAction(account);

  const failedCovenants = Object.entries(JSON.parse(activeBreachPeriod.per_covenant_json || "{}"))
    .filter(([, v]) => v === "FAIL")
    .map(([k]) => k);

  if (!account) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-[color:var(--muted)]">Connect the borrower&apos;s wallet to request a waiver.</p>
        <Button onClick={connect} loading={connecting}>
          Connect wallet
        </Button>
        {walletError && <p className="text-sm text-[color:var(--breach)]">{walletError}</p>}
      </div>
    );
  }

  async function submit() {
    if (!account) return;
    if (!covenantName) return;
    if (!rationale.trim() || rationale.length > MAX_RATIONALE_LEN) return;
    setDone(false);
    const ok = await run(async (client) => {
      const fees = await (client as any).estimateTransactionFees({});
      return client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "request_waiver",
        args: [covenantName, activeBreachPeriod.period_id, rationale.trim()],
        fees: { distribution: fees.distribution, feeValue: fees.feeValue },
      } as any) as Promise<`0x${string}`>;
    }, "a pending waiver request may already exist for this covenant/period, or the covenant may not have actually failed.");
    if (ok) {
      setRationale("");
      setDone(true);
      onSettled();
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <Field label={`Covenant that failed in period ${activeBreachPeriod.period_id}`}>
          <select className={inputClass} value={covenantName} onChange={(e) => setCovenantName(e.target.value)} disabled={submitting}>
            <option value="">select...</option>
            {failedCovenants.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rationale">
          <input
            className={inputClass}
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="One-time unplanned expense; underlying cash flow remains strong."
            disabled={submitting}
          />
        </Field>
      </div>
      <Button onClick={submit} loading={submitting} disabled={submitting || !covenantName || !rationale.trim()}>
        Request waiver
      </Button>
      {progress && <p className="mono text-xs text-[color:var(--muted)]">{STATUS_COPY[progress.statusName] ?? progress.statusName}</p>}
      {error && <p className="text-sm text-[color:var(--breach)]">{error}</p>}
      {done && !submitting && <p className="text-sm text-[color:var(--current)]">Waiver requested - waiting on the lender.</p>}
    </div>
  );
}

function WaiverDecisionRow({ waiver, waiverId, onSettled }: { waiver: Waiver; waiverId: number; onSettled: () => void }) {
  const { account, connecting, error: walletError, connect } = useWallet();
  const [note, setNote] = useState("");
  const { run, progress, error, submitting } = useWaiverAction(account);

  async function grant() {
    const ok = await run(async (client) => {
      const fees = await (client as any).estimateTransactionFees({});
      return client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "grant_waiver",
        args: [waiverId],
        fees: { distribution: fees.distribution, feeValue: fees.feeValue },
      } as any) as Promise<`0x${string}`>;
    }, "only the lender can decide a waiver.");
    if (ok) onSettled();
  }

  async function reject() {
    if (note.length > MAX_NOTE_LEN) return;
    const ok = await run(async (client) => {
      const fees = await (client as any).estimateTransactionFees({});
      return client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "reject_waiver",
        args: [waiverId, note.trim()],
        fees: { distribution: fees.distribution, feeValue: fees.feeValue },
      } as any) as Promise<`0x${string}`>;
    }, "only the lender can decide a waiver.");
    if (ok) onSettled();
  }

  if (!account) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-xs text-[color:var(--muted)]">Connect the lender&apos;s wallet to decide this waiver.</p>
        <Button onClick={connect} loading={connecting} variant="secondary">
          Connect
        </Button>
        {walletError && <p className="text-xs text-[color:var(--breach)]">{walletError}</p>}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2 border-t border-[color:var(--surface-border)] pt-2">
      <input
        className={inputClass}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Decision note (optional, only used if rejecting)"
        disabled={submitting}
      />
      <div className="flex gap-2">
        <Button onClick={grant} loading={submitting} disabled={submitting}>
          Grant
        </Button>
        <Button onClick={reject} loading={submitting} disabled={submitting} variant="secondary">
          Reject
        </Button>
      </div>
      {progress && <p className="mono text-xs text-[color:var(--muted)]">{STATUS_COPY[progress.statusName] ?? progress.statusName}</p>}
      {error && <p className="text-xs text-[color:var(--breach)]">{error}</p>}
    </div>
  );
}

function CureForm({ suggestedPeriodId, onSettled }: { suggestedPeriodId: number | null; onSettled: () => void }) {
  const { account, connecting, error: walletError, connect } = useWallet();
  const [periodId, setPeriodId] = useState(suggestedPeriodId ? String(suggestedPeriodId) : "");
  const [done, setDone] = useState(false);
  const { run, progress, error, submitting } = useWaiverAction(account);

  if (!account) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-[color:var(--muted)]">Connect a wallet to submit the cure - permissionless, anyone can call it.</p>
        <Button onClick={connect} loading={connecting} variant="secondary">
          Connect wallet
        </Button>
        {walletError && <p className="text-sm text-[color:var(--breach)]">{walletError}</p>}
      </div>
    );
  }

  async function submit() {
    const id = Number(periodId);
    if (!Number.isFinite(id) || id <= 0) return;
    setDone(false);
    const ok = await run(async (client) => {
      const fees = await (client as any).estimateTransactionFees({});
      return client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "cure",
        args: [id],
        fees: { distribution: fees.distribution, feeValue: fees.feeValue },
      } as any) as Promise<`0x${string}`>;
    }, "the referenced period must be genuinely later than the breach and must have passed every covenant.");
    if (ok) {
      setDone(true);
      onSettled();
    }
  }

  return (
    <div className="space-y-3">
      <Field label="Period id to cure with (must be a later period that passed every covenant)">
        <input
          className={inputClass}
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value)}
          placeholder="4"
          inputMode="numeric"
          disabled={submitting}
        />
      </Field>
      <Button onClick={submit} loading={submitting} disabled={submitting || !periodId}>
        Cure
      </Button>
      {progress && <p className="mono text-xs text-[color:var(--muted)]">{STATUS_COPY[progress.statusName] ?? progress.statusName}</p>}
      {error && <p className="text-sm text-[color:var(--breach)]">{error}</p>}
      {done && !submitting && <p className="text-sm text-[color:var(--current)]">Facility cured - back to current.</p>}
    </div>
  );
}

export default function WaiversPanel({
  state,
  waivers,
  activeBreachPeriod,
  latestPassingPeriodId,
  onSettled,
}: {
  state: FacilityState;
  waivers: Waiver[];
  activeBreachPeriod: Period | null;
  latestPassingPeriodId: number | null;
  onSettled: () => void;
}) {
  return (
    <div className="space-y-4">
      {state.status === "breach" && activeBreachPeriod && (
        <div className="rounded-lg border border-[color:var(--surface-border)] p-3">
          <p className="mb-3 text-sm text-[color:var(--muted)]">
            The facility is in breach as of period {activeBreachPeriod.period_id}. The borrower can request a
            waiver for each covenant that failed; the facility moves to Waived once every failed covenant has
            an individually granted waiver.
          </p>
          <RequestWaiverForm activeBreachPeriod={activeBreachPeriod} onSettled={onSettled} />
        </div>
      )}

      {state.status === "waived" && (
        <div className="rounded-lg border border-[color:var(--surface-border)] p-3">
          <p className="mb-3 text-sm text-[color:var(--muted)]">
            Every failed covenant from the breach has a granted waiver. The facility stays Waived until
            cure() is called referencing a genuinely later period that passed every covenant.
          </p>
          <CureForm suggestedPeriodId={latestPassingPeriodId} onSettled={onSettled} />
        </div>
      )}

      {waivers.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">No waivers requested yet.</p>
      ) : (
        <div className="space-y-3">
          {waivers.map((w, i) => {
            // get_waivers returns newest-first; waiver_id is the append
            // index, so the id for row i is (waiver_count - 1 - i).
            const waiverId = state.waiver_count - 1 - i;
            return (
              <div key={waiverId} className="rounded-lg border border-[color:var(--surface-border)] p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {w.covenant_name} / period {w.period_id}
                    </span>
                    <WaiverStatusBadge status={w.status} />
                  </div>
                  <span className="text-xs text-[color:var(--muted)]">{timeAgo(w.requested_at)}</span>
                </div>
                <p className="text-sm text-[color:var(--foreground)]">{w.rationale}</p>
                {w.status !== "pending" && w.decision_note && (
                  <p className="mt-1 text-xs text-[color:var(--muted)]">Lender note: {w.decision_note}</p>
                )}
                {w.status === "pending" && <WaiverDecisionRow waiver={w} waiverId={waiverId} onSettled={onSettled} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
