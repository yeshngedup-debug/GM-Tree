"use client";
import { useCallback, useEffect, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Trash2,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { themeFor, type Theme } from "@/lib/catalog";
type Submission = {
  id: string;
  leaf_id: string | null;
  message: string;
  selected_theme: Theme;
  visit_kind: "first" | "returning" | "";
  outcome: "approved" | "rejected";
  reason: string;
  created_at: string;
  leaf_message: string | null;
  leaf_status: string | null;
};
type History = {
  submissions: Submission[];
  total: number;
  page: number;
  pages: number;
};
export function SubmissionManager() {
  const [history, setHistory] = useState<History | null>(null),
    [query, setQuery] = useState(""),
    [outcome, setOutcome] = useState("all"),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState<string | null>(null);
  const load = useCallback(async () => {
    const result = await api<History>(
      `/api/admin/submissions?page=${page}&outcome=${outcome}&query=${encodeURIComponent(query)}`,
      { cache: "no-store" },
    );
    setHistory(result);
  }, [page, outcome, query]);
  useEffect(() => {
    const controller = new AbortController(),
      timer = setTimeout(() => {
        api<History>(
          `/api/admin/submissions?page=${page}&outcome=${outcome}&query=${encodeURIComponent(query)}`,
          { signal: controller.signal, cache: "no-store" },
        )
          .then(setHistory)
          .catch((error) => {
            if (!controller.signal.aborted) setError(error.message);
          });
      }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [page, outcome, query]);
  useEffect(() => {
    const timer = setInterval(() => {
      void load().catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [load]);
  async function update(item: Submission, remove = false) {
    setBusy(item.id);
    setError("");
    try {
      if (remove)
        await api("/api/admin/submissions", {
          method: "DELETE",
          body: JSON.stringify({ id: item.id }),
        });
      else
        await api("/api/admin", {
          method: "POST",
          body: JSON.stringify({
            action: "status",
            id: item.leaf_id,
            status: item.leaf_status === "approved" ? "hidden" : "approved",
          }),
        });
      await load();
      setDeleting(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update message.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl">Visitor voices</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Original messages, public interpretations, and moderation outcomes.
          </p>
        </div>
        <p className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-[10px] text-muted-foreground">
          <LockKeyhole size={12} />
          Private · staff access only
        </p>
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-border bg-card px-4">
          <Search size={16} className="text-muted-foreground" />
          <input
            aria-label="Search visitor messages"
            placeholder="Search original words or public leaf text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className="min-h-12 w-full min-w-0 bg-transparent text-sm"
          />
        </label>
        <select
          aria-label="Submission outcome"
          className="admin-select !w-auto"
          value={outcome}
          onChange={(event) => {
            setOutcome(event.target.value);
            setPage(1);
          }}
        >
          <option value="all">All messages</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-[hsl(0_72%_32%)]">
          {error}
        </p>
      )}
      <div className="space-y-4">
        {history?.submissions.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[10px]">
                <span
                  className={`rounded-full px-2 py-1 font-medium ${item.outcome === "rejected" ? "bg-destructive/10 text-destructive" : "bg-primary/15 text-foreground"}`}
                >
                  {item.outcome === "rejected"
                    ? "Not published"
                    : item.leaf_status === "hidden"
                      ? "Hidden"
                      : "Public"}
                </span>
                <span>{themeFor(item.selected_theme).short}</span>
                {item.visit_kind && (
                  <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">
                    {item.visit_kind === "returning"
                      ? "Returning visit"
                      : "First visit"}
                  </span>
                )}
              </div>
              <time className="text-[10px] text-muted-foreground">
                {new Date(item.created_at).toLocaleString("en-GB", {
                  timeZone: "Asia/Thimphu",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="eyebrow mb-2 text-[8px] text-muted-foreground">
                  Visitor's original words
                </p>
                <p className="break-words text-sm leading-relaxed">
                  {item.message}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/60 p-4">
                <p className="eyebrow mb-2 text-[8px] text-muted-foreground">
                  {item.outcome === "approved"
                    ? "Approved leaf"
                    : "Moderation outcome"}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.leaf_message || item.reason || "Not shared publicly."}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {item.leaf_id && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={Boolean(busy)}
                  onClick={() => update(item)}
                >
                  {busy === item.id ? (
                    <LoaderCircle className="orbit" size={13} />
                  ) : item.leaf_status === "approved" ? (
                    <EyeOff size={13} />
                  ) : (
                    <Eye size={13} />
                  )}{" "}
                  {item.leaf_status === "approved"
                    ? "Hide public leaf"
                    : "Restore public leaf"}
                </Button>
              )}
              {deleting === item.id ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border-destructive/30 bg-destructive/10 p-2">
                  <span className="text-xs">
                    Delete private words and hide its leaf?
                  </span>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={Boolean(busy)}
                    onClick={() => update(item, true)}
                  >
                    Delete message
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleting(null)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={Boolean(busy)}
                  onClick={() => setDeleting(item.id)}
                >
                  <Trash2 size={13} />
                  Remove private words
                </Button>
              )}
            </div>
          </article>
        ))}
        {history && !history.submissions.length && (
          <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            No visitor messages match. New messages appear here after
            submission.
          </div>
        )}
      </div>
      <div className="mt-6 flex items-center justify-between gap-3 text-xs">
        <span>
          {history?.total ?? 0} messages · Page {page} of {history?.pages ?? 1}
        </span>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            aria-label="Previous messages"
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            disabled={page >= (history?.pages ?? 1)}
            onClick={() => setPage((value) => value + 1)}
            aria-label="Next messages"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
      <p className="mt-6 max-w-3xl text-[10px] leading-relaxed text-muted-foreground">
        Original words are encrypted in the local database. Email addresses,
        phone-like numbers and links are redacted before storage. Earlier
        contributions from before private history was enabled have no
        recoverable original text; they remain in Public leaves. Removing
        private words hides the linked leaf and deletes this private record.
      </p>
    </section>
  );
}
