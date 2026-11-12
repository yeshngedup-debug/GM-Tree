"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Sparkles,
  Sprout,
  LoaderCircle,
} from "lucide-react";
import {
  themes,
  themeFor,
  type Theme,
  type Leaf,
  type ContributionReceipt,
} from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { ThemeIcon } from "@/components/theme-icon";
import { LeafResult } from "@/features/leaf/leaf-result";
import { uuid, api } from "@/lib/client";
import { themeSchema, contributionSchema } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { VisitorAccess } from "./visitor-access";

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute("content") || null;
}

export function JoinForm({ initialTheme }: { initialTheme?: Theme }) {
  const section = useRef<HTMLElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [hydrated, setHydrated] = useState(false),
    [online, setOnline] = useState(true),
    [paused, setPaused] = useState(false),
    [recovered, setRecovered] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme || "nature"),
    [step, setStep] = useState(0),
    [aspiration, setAspiration] = useState("");
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [leaf, setLeaf] = useState<Leaf | null>(null);
  const [replyMode, setReplyMode] = useState<"openai" | "offline">("offline");
  const [visitorType, setVisitorType] = useState<"first" | "returning">(
    "first",
  );
  const [showHistory, setShowHistory] = useState(false);
  const [reply, setReply] = useState(""),
    [original, setOriginal] = useState("");
  const key = useRef<string | null>(null),
    lock = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("gmc-hope-draft") || "null",
      ) as { aspiration?: string; theme?: string; key?: string } | null;
      const parsedTheme = themeSchema.safeParse(saved?.theme);
      if (
        saved &&
        typeof saved.aspiration === "string" &&
        saved.aspiration.length <= 200 &&
        parsedTheme.success
      ) {
        const nextAspiration = saved.aspiration;
        const nextTheme: Theme = initialTheme ?? parsedTheme.data ?? "nature";
        setTimeout(() => {
          setAspiration(nextAspiration);
          setTheme(nextTheme);
          setStep(saved.aspiration ? 1 : 0);
          setRecovered(Boolean(saved.aspiration));
        }, 0);
        // Never re-use the previous key when a theme shortcut changes intent.
        if (!initialTheme || initialTheme === parsedTheme.data)
          key.current = typeof saved.key === "string" ? saved.key : null;
      }
      const receipt = sessionStorage.getItem("gmc-hope-receipt");
      if (receipt && !saved?.aspiration)
        void api<{ leaf: Leaf }>(`/api/leaves/${encodeURIComponent(receipt)}`, {
          cache: "no-store",
        })
          .then((data) => {
            setLeaf(data.leaf);
            try {
              const cached = JSON.parse(
                sessionStorage.getItem("gmc-hope-conversation") || "null",
              ) as {
                leafId?: string;
                reply?: string;
                mode?: string;
                original?: string;
              } | null;
              if (
                cached?.leafId === data.leaf.id &&
                typeof cached.reply === "string" &&
                cached.reply.length <= 360 &&
                typeof cached.original === "string" &&
                cached.original.length <= 200
              ) {
                setReply(cached.reply);
                setOriginal(cached.original);
                setReplyMode(cached.mode === "openai" ? "openai" : "offline");
              }
            } catch {
              /* Optional private conversation recovery. */
            }
            setStep(2);
          })
          .catch(() => {
            sessionStorage.removeItem("gmc-hope-receipt");
          });
    } catch {
      /* Storage is optional on private browsers. */
    }
    setTimeout(() => setHydrated(true), 0);
    const changed = () => setOnline(navigator.onLine);
    changed();
    window.addEventListener("online", changed);
    window.addEventListener("offline", changed);
    const checkSettings = () => {
      api<{ settings: { acceptingContributions: boolean } }>(
        "/api/tree/settings",
        { cache: "no-store" },
      )
        .then((data) => setPaused(!data.settings.acceptingContributions))
        .catch((err) => {
          // Settings poll is best-effort; retried every 15s, so a failure is safe to ignore.
          void err;
        });
    };
    checkSettings();
    const timer = setInterval(checkSettings, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", changed);
      window.removeEventListener("offline", changed);
    };
  }, [initialTheme]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (leaf) sessionStorage.removeItem("gmc-hope-draft");
      else
        sessionStorage.setItem(
          "gmc-hope-draft",
          JSON.stringify({ theme, aspiration, key: key.current }),
        );
    } catch {
      /* Optional draft recovery. */
    }
  }, [theme, aspiration, leaf, hydrated]);
  useEffect(() => {
    if (hydrated && step === 1) {
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      textarea.current?.focus();
    }
  }, [step, hydrated]);
  function grow() {
    const element = textarea.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }
  useEffect(grow, [aspiration]);
  function edit(text: string) {
    setAspiration(text);
    setError("");
    key.current = null;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    section.current?.querySelector("textarea")?.blur();
    setBusy(true);
    setError("");
    key.current ??= uuid();
    try {
      sessionStorage.setItem(
        "gmc-hope-draft",
        JSON.stringify({ theme, aspiration, key: key.current }),
      );
    } catch {
      /* Optional recovery. */
    }
    try {
      const body = contributionSchema.parse({
        aspiration,
        theme,
        consent,
        idempotencyKey: key.current,
        visitor_type: visitorType,
      });
      const data = await api<ContributionReceipt>("/api/contributions", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken()!} : {}),
        },
      });
      setLeaf(data.leaf);
      setReply(data.reply);
      setReplyMode(data.reply_mode);
      setOriginal(aspiration);
      try {
        sessionStorage.setItem("gmc-hope-receipt", data.leaf.id);
        sessionStorage.setItem(
          "gmc-hope-conversation",
          JSON.stringify({
            leafId: data.leaf.id,
            reply: data.reply,
            mode: data.reply_mode,
            original: aspiration,
          }),
        );
      } catch {
        /* Optional receipt recovery. */
      }
      setAspiration("");
      setStep(2);
    } catch (err) {
      setError(
        err instanceof Error && err.name === "TimeoutError"
          ? "This is taking longer than expected. Retry to recover your leaf safely."
          : err instanceof TypeError
            ? "We couldn't reach the tree. Your hope is still here. Check your Wi-Fi and try again."
            : err instanceof Error
              ? err.message
              : "Please try again.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  function reset() {
    try {
      sessionStorage.removeItem("gmc-hope-receipt");
      sessionStorage.removeItem("gmc-hope-conversation");
    } catch {
      /* Optional storage. */
    }
    key.current = null;
    setLeaf(null);
    setReply("");
    setOriginal("");
    setConsent(false);
    setStep(0);
    setRecovered(false);
  }
  const themeColor = themeFor(theme).color;
  if (leaf)
    return (
      <section className="w-full space-y-6 sm:max-w-md sm:mx-auto" aria-label="Your leaf">
        <LeafResult
          leaf={leaf}
          compact
          reply={reply}
          replyMode={replyMode}
          original={original}
        />
        <Button
          className="w-full"
          variant="ghost"
          size="sm"
          onClick={reset}
        >
          Grow another hope
          <Sprout size={14} />
        </Button>
      </section>
    );
  return (
    <section ref={section} className="w-full space-y-10 sm:max-w-md sm:mx-auto" aria-label="Add your hope">
      <div className="visit-choice" aria-label="Your visit">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
          Your visit
        </span>
        <div role="group" aria-label="First or returning visitor">
          <button
            type="button"
            aria-pressed={visitorType === "first"}
            disabled={busy}
            onClick={() => {
              setVisitorType("first");
              setShowHistory(false);
            }}
            className="min-h-11 shrink-0 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
          >
            First visit
          </button>
          <button
            type="button"
            aria-pressed={visitorType === "returning"}
            disabled={busy}
            onClick={() => {
              setVisitorType("returning");
              setShowHistory(true);
            }}
            className="min-h-11 shrink-0 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50 disabled:pointer-events-none"
          >
            Returning
          </button>
        </div>
        <Link
          href="/voices"
          className="text-[10px] underline underline-offset-4 text-muted-foreground"
        >
          My voices
        </Link>
      </div>
      {showHistory && (
        <div className="mb-4">
          <VisitorAccess onDismiss={() => setShowHistory(false)} />
        </div>
      )}
      <ol aria-label="Your progress" className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider">
        {["Theme", "Your note", "Your leaf"].map((label, index) => (
          <li key={label} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium border",
                step === index
                  ? "bg-accent border-accent text-primary-foreground"
                  : "border-border text-muted-foreground",
              )}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "leading-4",
                step === index
                  ? "font-medium text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>
      {!online && (
        <p role="status" className="rounded-xl bg-muted p-3 text-sm leading-6 text-muted-foreground">
          You're offline. Your note is saved in this tab; reconnect to send it.
        </p>
      )}
      {paused && (
        <p role="status" className="rounded-xl bg-muted p-3 text-sm leading-6 text-muted-foreground">
          The tree is resting for a moment. Keep your hope here and try again
          shortly.
        </p>
      )}
      {recovered && aspiration && (
        <p className="mb-3 text-[10px] leading-5 text-muted-foreground">
          Your unfinished note is back.
        </p>
      )}
      {step === 0 ? (
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
              Step 1 of 3
            </p>
            <h1 className="text-3xl tracking-tight">What matters to you?</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Choose a branch. Your words come next.
            </p>
          </div>
          <fieldset className="border border-border rounded-2xl p-1">
            <legend className="sr-only">Choose a theme</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {themes.map((item) => (
                <label
                  key={item.id}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-3 rounded-xl bg-card border border-transparent p-3 transition-colors min-h-[56px]",
                    theme === item.id
                      ? "bg-accent border-accent/40"
                      : "hover:bg-muted hover:border-border",
                  )}
                >
                  <input
                    className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    type="radio"
                    name="theme"
                    checked={theme === item.id}
                    onChange={() => {
                      setTheme(item.id);
                      key.current = null;
                    }}
                  />
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: themeColor }}
                  >
                    <ThemeIcon theme={item.id} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium leading-5">
                      {item.label}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {item.short}
                    </span>
                  </div>
                  {theme === item.id && (
                    <Check size={14} className="shrink-0 text-primary-foreground" />
                  )}
                </label>
              ))}
            </div>
          </fieldset>
          <Button onClick={() => setStep(1)} className="mt-2 w-full">
            Continue
            <ArrowRight size={16} />
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                "border border-border text-muted-foreground",
              )}
              style={{ backgroundColor: themeColor }}
            >
              <ThemeIcon theme={theme} size={14} className="text-foreground" />
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {themeFor(theme).short}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => setStep(0)}
              className="min-h-10 text-[11px] text-muted-foreground hover:underline"
            >
              Change theme
            </button>
          </div>
          <h1 className="text-2xl tracking-tight">Share a little hope.</h1>
          <label htmlFor="aspiration" className="block text-sm font-medium">
            What is your hope for the city?
          </label>
          <textarea
            ref={textarea}
            id="aspiration"
            required
            minLength={3}
            maxLength={200}
            value={aspiration}
            disabled={busy}
            onChange={(event) => edit(event.target.value)}
            placeholder="A hope, a thought, or something you'd love to see…"
            aria-describedby="aspiration-help"
            className="w-full min-h-[140px] resize-none rounded-xl border border-border bg-muted p-4 text-base leading-relaxed font-sans focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:opacity-60 disabled:pointer-events-none"
          />
          <div
            id="aspiration-help"
            className="flex justify-between gap-3 text-[10px] text-muted-foreground"
          >
            <span>Leave out names, contact details and links.</span>
            <span className="shrink-0">{aspiration.length} / 200</span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => edit(themeFor(theme).prompt)}
            className="inline-flex min-h-10 items-center gap-2 text-[11px] text-muted-foreground hover:underline"
          >
            <Sparkles size={13} />
            Try an example
          </button>
          <label className="flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              required
              checked={consent}
              disabled={busy}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
            />
            <span>
              I agree to share my anonymous leaf publicly and let staff
              privately review my note.
            </span>
          </label>
          <details className="text-[10px] text-muted-foreground">
            <summary className="cursor-pointer min-h-[36px] py-1.5">
              Privacy &amp; how this works
            </summary>
            <p className="leading-relaxed pt-2">
              No account is needed. Only your approved leaf is public; your note
              and personal reply are not shown on the shared tree. When enabled,
              OpenAI interprets your note and checks it before publication.
              Otherwise, a matching offline reply and curated leaf are used.
              Your note and reply are saved privately with encryption for safe
              retries. This tab keeps your unfinished note and reply so a
              refresh can recover them.{" "}
              <Link href="/privacy" className="underline">
                Read the participation policy.
              </Link>
            </p>
          </details>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-[hsl(0_72%_88%)] bg-[hsl(0_72%_97%)] p-3 text-sm leading-6 text-[hsl(0_72%_32%)]"
            >
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              busy ||
              !consent ||
              aspiration.trim().length < 3 ||
              !online ||
              paused
            }
            className="w-full"
          >
            {busy ? (
              <>
                <LoaderCircle size={17} className="orbit" />
                Finding your branch…
              </>
            ) : (
              <>
                Grow my leaf
                <Sprout size={17} />
              </>
            )}
          </Button>
          {busy && (
            <p
              role="status"
              className="text-center text-[10px] leading-5 text-muted-foreground"
            >
              Reflecting on your note and making room on the tree.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
