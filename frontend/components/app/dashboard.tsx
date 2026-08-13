'use client';

import { useCallback, useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_ANALYTICS_API_URL ?? 'http://localhost:8000';
const POLL_INTERVAL_MS = 15000;

interface Summary {
  total_calls: number;
  successful_calls: number;
  failed_calls: number;
  escalations_created: number;
  success_rate: number;
}

interface CallRecord {
  call_id: string;
  started_at: string;
  duration_seconds: number;
  status: 'completed' | 'failed';
  success: boolean;
  escalation_created: boolean;
  escalation_reference_id: string | null;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso + 'Z').toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'neutral' | 'success' | 'failure';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-[var(--cv-teal)]'
      : tone === 'failure'
        ? 'text-destructive'
        : 'text-foreground';

  return (
    <div className="border-border bg-card flex flex-col gap-1 rounded-2xl border p-5 shadow-sm sm:p-6">
      <span className="text-muted-foreground text-sm font-medium">{label}</span>
      <span className={`font-heading text-3xl font-bold sm:text-4xl ${toneClass}`}>{value}</span>
    </div>
  );
}

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, callsRes] = await Promise.all([
        fetch(`${API_BASE}/analytics/summary`, { cache: 'no-store' }),
        fetch(`${API_BASE}/calls?limit=25`, { cache: 'no-store' }),
      ]);

      if (!summaryRes.ok || !callsRes.ok) {
        throw new Error('Analytics API returned an error');
      }

      const summaryData: Summary = await summaryRes.json();
      const callsData: CallRecord[] = await callsRes.json();

      setSummary(summaryData);
      setCalls(callsData);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not reach the analytics API at ${API_BASE}. Is escalation_api.py running?`
          : 'Unknown error'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <main className="mx-auto flex min-h-svh max-w-5xl flex-col gap-6 px-4 py-8 sm:px-8 sm:py-12">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-bold sm:text-3xl">Call Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Live metrics from real Care Voice calls. No transcripts or medical details are shown.
        </p>
      </div>

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-2xl border p-4 text-sm">
          {error}
        </div>
      )}

      {loading && !summary ? (
        <div className="text-muted-foreground text-sm">Loading analytics…</div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard label="Total Calls" value={summary.total_calls} tone="neutral" />
            <MetricCard
              label="Successful Calls"
              value={summary.successful_calls}
              tone="success"
            />
            <MetricCard label="Failed Calls" value={summary.failed_calls} tone="failure" />
          </div>

          <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 text-sm sm:p-5">
            <span className="text-muted-foreground">
              Success rate:{' '}
              <span className="text-foreground font-semibold">{summary.success_rate}%</span>
            </span>
            <span className="text-muted-foreground">
              Escalations created:{' '}
              <span className="text-foreground font-semibold">
                {summary.escalations_created}
              </span>
            </span>
          </div>
        </>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-lg font-semibold">Call History</h2>

        {calls.length === 0 && !loading ? (
          <div className="border-border bg-card text-muted-foreground rounded-2xl border p-6 text-center text-sm">
            No calls recorded yet. Make a call from the landing page to see it here.
          </div>
        ) : (
          <div className="border-border bg-card overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b">
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">Duration</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Outcome</th>
                  <th className="px-4 py-3 font-medium">Escalation Ref</th>
                </tr>
              </thead>
              <tbody>
                {calls.map((call) => (
                  <tr key={call.call_id} className="border-border/60 border-b last:border-0">
                    <td className="text-foreground px-4 py-3 whitespace-nowrap">
                      {formatTimestamp(call.started_at)}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                      {formatDuration(call.duration_seconds)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={
                          call.status === 'completed'
                            ? 'text-[var(--cv-teal)]'
                            : 'text-destructive'
                        }
                      >
                        {call.status === 'completed' ? 'Completed' : 'Failed'}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                      {call.escalation_created ? 'Escalated' : 'Guidance given'}
                    </td>
                    <td className="text-muted-foreground px-4 py-3 font-mono text-xs whitespace-nowrap">
                      {call.escalation_reference_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}