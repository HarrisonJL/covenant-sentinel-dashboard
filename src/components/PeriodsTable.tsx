import type { Period } from "@/lib/useCovenantState";
import { timeAgo } from "@/lib/format";
import { VerdictBadge } from "@/components/ui";

export default function PeriodsTable({ periods }: { periods: Period[] }) {
  if (periods.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No disclosures submitted yet.</p>;
  }
  return (
    <div className="space-y-3">
      {periods.map((p) => (
        <div key={p.period_id} className="rounded-lg border border-[color:var(--surface-border)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Period {p.period_id}</span>
              <VerdictBadge verdict={p.verdict} />
            </div>
            <span className="text-xs text-[color:var(--muted)]">{timeAgo(p.submitted_at)}</span>
          </div>
          {p.disclosure_url ? (
            <p className="mb-2 text-sm text-[color:var(--foreground)]">
              Fetched live from{" "}
              <a
                href={p.disclosure_url}
                target="_blank"
                rel="noreferrer"
                className="text-[color:var(--accent)] underline"
              >
                {p.disclosure_url}
              </a>
            </p>
          ) : (
            <p className="mb-2 text-sm text-[color:var(--foreground)]">{p.disclosure_text}</p>
          )}
          <p className="mono text-xs text-[color:var(--muted)]">extracted: {p.extracted_json}</p>
          <p className="mono text-xs text-[color:var(--muted)]">per covenant: {p.per_covenant_json}</p>
        </div>
      ))}
    </div>
  );
}
