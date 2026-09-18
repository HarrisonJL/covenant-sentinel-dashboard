"use client";

import { useRef, useState } from "react";
import { CONTRACT_ADDRESS, getWriteClient } from "@/lib/genlayer";
import { useWallet } from "@/lib/useWallet";
import { pollTransaction, STATUS_COPY, STATUS_NAMES, type Progress } from "@/lib/pollTransaction";
import { Button } from "@/components/ui";

const ACCEPTED = "5";

export default function FlagReportingDefaultButton({
  deadlineLikelyPassed,
  onSettled,
}: {
  deadlineLikelyPassed: boolean;
  onSettled: () => void;
}) {
  const { account, connecting, error: walletError, connect } = useWallet();
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const cancelledRef = useRef(false);

  async function submit() {
    if (!account) return;
    setSubmitting(true);
    setError(null);
    setDone(false);
    cancelledRef.current = false;
    try {
      const client = getWriteClient(account);
      const txHash = await client.writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        functionName: "flag_reporting_default",
        args: [],
        value: 0n,
      });
      const tx = await pollTransaction(client, txHash, "ACCEPTED", setProgress, () => cancelledRef.current);
      const statusNum = String(tx.status);
      if (statusNum !== ACCEPTED) {
        const statusName = STATUS_NAMES[statusNum] ?? statusNum;
        setError(STATUS_COPY[statusName] ?? `Not accepted (status: ${statusName}).`);
        return;
      }
      setDone(true);
      onSettled();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to flag reporting default.");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  if (!account) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-[color:var(--muted)]">
          Connect a wallet to flag this facility if it has gone quiet past its reporting deadline.
        </p>
        <Button onClick={connect} loading={connecting} variant="secondary">
          Connect wallet
        </Button>
        {walletError && <p className="text-sm text-[color:var(--breach)]">{walletError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[color:var(--muted)]">
        Anyone can call this once the borrower has gone past the reporting deadline without a new
        disclosure - the contract checks the elapsed time itself and rejects the call if it
        hasn&apos;t actually elapsed.{" "}
        {deadlineLikelyPassed
          ? "Based on the last report time above, the deadline looks like it has passed."
          : "Based on the last report time above, the deadline does not look like it has passed yet."}
      </p>
      <Button onClick={submit} loading={submitting} disabled={submitting} variant="secondary">
        Flag reporting default
      </Button>
      {progress && submitting && (
        <p className="mono text-xs text-[color:var(--muted)]">{STATUS_COPY[progress.statusName] ?? progress.statusName}</p>
      )}
      {error && <p className="text-sm text-[color:var(--breach)]">{error}</p>}
      {done && !submitting && <p className="text-sm text-[color:var(--breach)]">Facility flagged as reporting default.</p>}
    </div>
  );
}
