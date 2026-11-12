"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";

export type VisitHistory = {
  linked?: boolean;
  authenticated: boolean;
  total: number;
  page: number;
  pages: number;
  voices: {
    id: string;
    leaf_message: string;
    category: string;
    chamber_id: number;
    created_at: string;
    status: string;
    note: string | null;
    reply: string | null;
  }[];
};
export function VisitorAccess({
  leafId,
  onUnlocked,
  onDismiss,
}: {
  leafId?: string;
  onUnlocked?: () => void;
  onDismiss?: () => void;
}) {
  const [known, setKnown] = useState(false),
    [open, setOpen] = useState(!leafId);
  const [saved, setSaved] = useState(false);
  const [cid, setCid] = useState(""),
    [pin, setPin] = useState(""),
    [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    api<VisitHistory>(
      `/api/visitor${leafId ? `?leafId=${encodeURIComponent(leafId)}` : ""}`,
      { cache: "no-store" },
    )
      .then((data) => {
        if (alive && data.authenticated) {
          setKnown(true);
          setSaved(Boolean(data.linked));
          onUnlocked?.();
        }
      })
      .catch((err) => {
        // Best-effort history check; log but don't block the UI.
        console.error("Visitor history check failed:", err);
      });
    return () => {
      alive = false;
    };
  }, [onUnlocked, leafId]);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      await api("/api/visitor", {
        method: "PATCH",
        body: JSON.stringify({ leafId, consent }),
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api<VisitHistory>("/api/visitor", {
        method: "POST",
        body: JSON.stringify({
          action: leafId ? "remember" : "signin",
          cid,
          pin,
          ...(leafId ? { leafId, consent } : {}),
        }),
      });
      setCid("");
      setPin("");
      setKnown(true);
      setSaved(Boolean(leafId));
      onUnlocked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className={`visitor-access ${leafId ? "is-invitation" : ""}`}
      aria-label={
        leafId ? "Remember your voice" : "Unlock your previous voices"
      }
    >
      <div className="flex items-start gap-3">
        <span className="visitor-lock">
          <LockKeyhole size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg">
            {known && (!leafId || saved)
              ? "Your voice has a home."
              : known
                ? "Keep this voice with your others."
                : leafId
                  ? "Find your voice next time."
                  : "Welcome back."}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {known
              ? "Open your private history to revisit your notes and replies."
              : leafId
                ? "Optionally leave your CID and a private PIN to revisit this note on your next visit."
                : "Enter your CID and private 6-digit PIN to see your previous notes. You can also add a new hope without signing in."}
          </p>
        </div>
      </div>
      {known ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {(!leafId || saved) && (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Check size={15} />{" "}
              {leafId ? "Connected to your visit history" : "History unlocked"}
            </span>
          )}
          {leafId && !saved && (
            <Button
              size="sm"
              disabled={busy || !consent}
              onClick={() => void connect()}
              className="w-full sm:w-auto"
            >
              Connect this voice to my history
            </Button>
          )}
          <Button asChild size="sm" className="w-full sm:w-auto">
            <Link href="/voices">
              My previous voices <ArrowRight size={14} />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {!open && (
            <Button className="mt-4 w-full" onClick={() => setOpen(true)}>
              Add my CID (optional) <ArrowRight size={15} />
            </Button>
          )}
          {open && (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-3">
                <label className="block text-sm">
                  CID
                  <input
                    className="visitor-input"
                    aria-label="CID"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    pattern="[0-9]{11}"
                    minLength={11}
                    maxLength={11}
                    placeholder="11 digits"
                    required
                    value={cid}
                    onChange={(event) =>
                      setCid(event.target.value.replace(/\D/g, ""))
                    }
                    disabled={busy}
                  />
                </label>
                <label className="block text-sm">
                  Private PIN
                  <input
                    className="visitor-input"
                    aria-label="Private PIN"
                    type="password"
                    inputMode="numeric"
                    autoComplete={leafId ? "new-password" : "current-password"}
                    pattern="[0-9]{6}"
                    minLength={6}
                    maxLength={6}
                    placeholder="6 digits"
                    required
                    value={pin}
                    onChange={(event) =>
                      setPin(event.target.value.replace(/\D/g, ""))
                    }
                    disabled={busy}
                  />
                </label>
              </div>
              {leafId && (
                <label className="flex items-start gap-2 text-sm leading-6">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    required
                    disabled={busy}
                  />
                  <span>
                    I choose to connect this voice and future submissions while
                    signed in. I’ll keep my PIN private.
                  </span>
                </label>
              )}
              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-800"
                >
                  {error}
                </p>
              )}
              <Button
                className="w-full"
                type="submit"
                disabled={
                  busy ||
                  cid.length !== 11 ||
                  pin.length !== 6 ||
                  (!!leafId && !consent)
                }
              >
                {busy ? (
                  <LoaderCircle size={16} className="orbit" />
                ) : (
                  <LockKeyhole size={16} />
                )}
                {leafId ? "Remember this voice" : "Unlock my voices"}
              </Button>
              <p className="text-[10px] leading-5 text-muted-foreground">
                Your CID is kept as a protected lookup, never on the tree or
                sent to AI. Use your existing PIN if you have saved a voice
                before. Sign-in lasts 12 hours on this browser.
              </p>
              {leafId && (
                <p className="text-[10px] leading-5 text-muted-foreground">
                  Choose a PIN you can remember; staff cannot recover it.
                </p>
              )}
            </form>
          )}
        </>
      )}
      {known && error && (
        <p role="alert" className="mt-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {onDismiss && (
        <button
          type="button"
          className="mt-4 min-h-10 text-sm text-muted-foreground"
          onClick={onDismiss}
        >
          Continue with a new hope
        </button>
      )}
    </section>
  );
}
