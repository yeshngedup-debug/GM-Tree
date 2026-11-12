"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sprout,
  ArrowUpRight,
  Plus,
  Trash2,
  Sparkles,
  Search,
  MessageSquare,
  SlidersHorizontal,
  Monitor,
  PanelLeftClose,
  Menu,
  ArrowLeft,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { themes, themeFor, type Leaf, type TreeStats } from "@/lib/catalog";
import { api } from "@/lib/client";
import { Card } from "@/components/ui/card";
import { TreeSettingsPanel } from "./tree-settings-panel";
import { SubmissionManager } from "./submission-manager";

function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta?.getAttribute("content") || null;
}
type Dashboard = {
  leaves: (Leaf & { status: "approved" | "hidden" })[];
  stats: TreeStats;
  ai: string;
  model: string;
  metrics?: Record<string, number>;
  audit?: { action: string; leaf_id: string | null; created_at: string }[];
};
export function AdminConsole() {
  const [menuOpen, setMenuOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Tab") return;
      const items = sidebar.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!items?.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [menuOpen]);
  const [tab, setTab] = useState<"leaves" | "visitors" | "tree">("leaves");
  const [authenticated, setAuthenticated] = useState<boolean | null>(null),
    [configured, setConfigured] = useState(true),
    [password, setPassword] = useState("");
  const [data, setData] = useState<Dashboard | null>(null),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [confirmClear, setConfirmClear] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin", { cache: "no-store" });
    if (response.status === 401) {
      setMenuOpen(false);
      setAuthenticated(false);
      return;
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
  }, []);
  useEffect(() => {
    let alive = true;
    api<{ authenticated: boolean; configured: boolean }>("/api/admin/session")
      .then((session) => {
        if (alive) {
          setAuthenticated(session.authenticated);
          setConfigured(session.configured);
        }
      })
      .catch(() => {
        if (alive) {
          setAuthenticated(false);
          setError("Could not connect to the local server.");
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    // Async error handling in a .catch() handler runs asynchronously, not
    // synchronously within the effect body, so set-state-in-effect does not apply.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
    const timer = setInterval(() => {
      void load().catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [authenticated, load]);
  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy("login");
    setError("");
    try {
      await api("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({ password }),
        headers: {
          ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken()!} : {}),
        },
      });
      setAuthenticated(true);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy("");
    }
  }
  async function action(body: Record<string, string>, label: string) {
    if (busy) return;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await api("/api/admin", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken()!} : {}),
        },
      });
      await load();
      setNotice(
        label === "seed"
          ? "24 illustrative demo leaves are ready (existing demo data is kept)."
          : label === "clear_demo"
            ? "Demo leaves removed. Visitor contributions are kept."
            : "The tree has been updated.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy("");
      setConfirmClear(false);
    }
  }
  async function logout() {
    try {
      await api("/api/admin/session", {
        method: "DELETE",
        headers: {
          ...(getCsrfToken() ? { "X-CSRF-Token": getCsrfToken()!} : {}),
        },
      });
      setMenuOpen(false);
      setAuthenticated(false);
      setData(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-out failed.");
    }
  }
  if (authenticated === null)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="orbit" />
        <span className="sr-only">Loading staff console</span>
      </main>
    );
  if (!authenticated)
    return (
      <main className="staff-login mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-7 px-6 py-12">
        <Brand />
        <div>
          <p className="eyebrow mb-4 text-muted-foreground">
            Experience Centre staff
          </p>
          <h1 className="text-4xl">Care for the canopy.</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Manage the shared tree, review public leaves and prepare your
            demonstration.
          </p>
        </div>
        <form
          onSubmit={login}
          className="space-y-4 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-card)]"
        >
          <label htmlFor="staff-password" className="block text-xs font-medium">
            Staff password
          </label>
          <input
            id="staff-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-xl border border-input bg-background p-4 text-sm"
          />
          {!configured && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              Staff access is not configured. Run <code>npm run setup</code> on
              the host laptop and restart the server.
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-[hsl(0_72%_32%)]">
              {error}
            </p>
          )}
          <Button
            disabled={Boolean(busy) || !configured}
            className="w-full"
            type="submit"
          >
            {busy ? (
              <LoaderCircle size={16} className="orbit" />
            ) : (
              <ShieldCheck size={16} />
            )}
            Sign in
          </Button>
        </form>
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          The host laptop's .env.local file contains your staff password. Your
          session expires after eight hours.
        </p>
        <Link href="/" className="text-xs underline">
          Back to the tree
        </Link>
      </main>
    );
  const visible =
    data?.leaves.filter(
      (leaf) =>
        (filter === "all" ||
          leaf.status === filter ||
          (filter === "demo" && leaf.is_demo)) &&
        (!query ||
          `${leaf.leaf_message} ${themeFor(leaf.category).label}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    ) || [];
  return (
    <div className="admin-shell">
      {menuOpen && (
        <button
          className="admin-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        ref={sidebar}
        id="staff-sidebar"
        aria-label="Staff navigation"
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen ? true : undefined}
        className={`admin-sidebar ${menuOpen ? "is-open" : ""}`}
      >
        <div className="flex items-center justify-between gap-2">
          <Brand compact />
          <button
            className="admin-close"
            aria-label="Close sidebar"
            onClick={() => setMenuOpen(false)}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>
        <p className="eyebrow mb-2.5 mt-9 px-3 text-muted-foreground">
          Workspace
        </p>
        <nav aria-label="Staff sections" className="space-y-0.5">
          {(
            [
              ["leaves", "Public leaves", Sprout],
              ["visitors", "Visitor messages", MessageSquare],
              ["tree", "Tree & display", SlidersHorizontal],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setTab(id);
                setMenuOpen(false);
              }}
              aria-current={tab === id ? "page" : undefined}
              className="admin-nav-item"
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>{label}</span>
              {id === "leaves" && data && (
                <span aria-hidden="true" className="admin-nav-count">
                  {data.stats.total}
                </span>
              )}
            </button>
          ))}
        </nav>
        <p className="eyebrow mb-2.5 mt-7 px-3 text-muted-foreground">
          Experience
        </p>
        <nav aria-label="Experience links" className="space-y-0.5">
          <Link href="/tree" className="admin-nav-item">
            <SlidersHorizontal size={18} strokeWidth={1.5} />
            Tree Studio
            <ArrowUpRight size={13} className="ml-auto" />
          </Link>
          <Link href="/" className="admin-nav-item">
            <ArrowLeft size={18} strokeWidth={1.5} />
            Visitor website
          </Link>
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="rounded-2xl bg-foreground p-5 text-background">
            <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-primary">
              <Monitor size={18} />
            </span>
            <h2 className="text-lg text-background">Room to grow.</h2>
            <p className="mb-5 mt-2 text-xs leading-5 text-background/60">
              Bring the collective canopy to your reception screen.
            </p>
            <Link
              href="/display"
              target="_blank"
              className="flex min-h-10 items-center justify-between rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open display
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <button onClick={logout} className="admin-nav-item mt-4">
            <LogOut size={17} />
            Sign out
          </button>
          <p className="px-3 pt-3 text-[9px] text-muted-foreground">
            Gelephu experience centre · Staff workspace
          </p>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <button
              className="admin-menu"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              aria-controls="staff-sidebar"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <span className="text-xs text-muted-foreground">
              Workspace <span className="mx-3 text-border">/</span>
              <span className="font-medium text-foreground">
                {tab === "tree"
                  ? "Tree & display"
                  : tab === "visitors"
                    ? "Visitor messages"
                    : "Public leaves"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Local workspace
            </span>
            <span
              aria-label="Signed in as staff"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"
            >
              <ShieldCheck size={17} />
            </span>
          </div>
        </header>
        <main className="admin-content">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-3 text-muted-foreground">
                GM Tree · Staff console
              </p>
              <h1 className="text-3xl tracking-tight lg:text-4xl">
                A little care helps it grow.
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                A space for every voice, and a view of everything taking root.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void load().catch((err) => setError(err.message))}
            >
              <RefreshCw size={13} />
              Refresh
            </Button>
          </div>
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-xl border border-[hsl(0_72%_88%)] bg-[hsl(0_72%_97%)] p-4 text-sm text-[hsl(0_72%_32%)]"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="mb-5 rounded-xl border border-primary/25 bg-primary/10 p-4 text-sm"
            >
              {notice}
            </p>
          )}
          {tab === "visitors" ? (
            <SubmissionManager />
          ) : tab === "tree" ? (
            <TreeSettingsPanel leaves={data?.leaves || []} />
          ) : (
            <>
              <div className="admin-stats mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
                {[
                  ["Public hopes", data?.stats.total ?? "-"],
                  ["Added today", data?.stats.today ?? "-"],
                  ["Demo leaves", data?.stats.demo ?? "-"],
                  [
                    "Interpretation",
                    data?.ai === "openai" ? "OpenAI" : "Offline fallback",
                  ],
                ].map(([label, value]) => (
                  <Card key={label} className="p-5">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-3 text-2xl font-medium tracking-tight lg:text-3xl">
                      {value}
                    </p>
                    {label === "Interpretation" && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {data?.ai === "openai"
                          ? data.model
                          : "Add a provider key to enable OpenAI"}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                <section className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <h2 className="text-xl">The collective canopy</h2>
                    <span className="shrink-0 rounded-full border border-border bg-muted px-3 py-1 text-[10px] text-muted-foreground">
                      {visible.length}{" "}
                      {visible.length === 1 ? "leaf" : "leaves"}
                    </span>
                  </div>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex gap-1 rounded-xl border border-border bg-muted p-1">
                      {["all", "approved", "hidden", "demo"].map((item) => (
                        <button
                          key={item}
                          onClick={() => setFilter(item)}
                          className={`min-h-9 rounded-lg px-3 text-xs capitalize transition-colors ${filter === item ? "border border-border bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                        >
                          {item === "approved" ? "Public" : item}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3">
                      <Search size={14} className="text-muted-foreground" />
                      <input
                        aria-label="Search leaves"
                        placeholder="Find a hope…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        className="min-h-10 w-40 bg-transparent text-xs"
                      />
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-border bg-muted text-[10px] text-muted-foreground">
                        <tr>
                          <th className="p-4 font-medium">The hope</th>
                          <th className="hidden p-4 font-medium sm:table-cell">
                            Status
                          </th>
                          <th className="p-4 text-right font-medium">Care</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((leaf) => (
                          <tr key={leaf.id} className="admin-leaf-row">
                            <td className="p-4">
                              <p className="max-w-lg text-sm leading-relaxed">
                                {leaf.leaf_message}
                              </p>
                              <p className="mt-2 text-[10px] text-muted-foreground">
                                <span
                                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                                  style={{
                                    background: "var(--primary)",
                                  }}
                                />
                                {themeFor(leaf.category).short} ·{" "}
                                {leaf.is_demo ? "Demo · " : ""}
                                {leaf.mode === "openai"
                                  ? "OpenAI"
                                  : "Curated"}{" "}
                                ·{" "}
                                {new Date(leaf.created_at).toLocaleTimeString(
                                  "en-GB",
                                  {
                                    timeZone: "Asia/Thimphu",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </p>
                            </td>
                            <td className="hidden p-4 sm:table-cell">
                              <span
                                className={`rounded-full px-2 py-1 text-[10px] font-medium ${leaf.status === "approved" ? "bg-primary/15 text-foreground" : "bg-muted text-muted-foreground"}`}
                              >
                                {leaf.status === "approved"
                                  ? "Public"
                                  : "Hidden"}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              <Button
                                size="icon"
                                variant="ghost"
                                disabled={Boolean(busy)}
                                aria-label={
                                  leaf.status === "approved"
                                    ? "Hide leaf"
                                    : "Restore leaf"
                                }
                                onClick={() =>
                                  action(
                                    {
                                      action: "status",
                                      id: leaf.id,
                                      status:
                                        leaf.status === "approved"
                                          ? "hidden"
                                          : "approved",
                                    },
                                    leaf.id,
                                  )
                                }
                              >
                                {busy === leaf.id ? (
                                  <LoaderCircle size={16} className="orbit" />
                                ) : leaf.status === "approved" ? (
                                  <EyeOff size={16} />
                                ) : (
                                  <Eye size={16} />
                                )}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!visible.length && (
                      <div className="p-10 text-center">
                        <Sprout
                          size={28}
                          strokeWidth={1}
                          className="mx-auto mb-3"
                        />
                        <p className="text-sm">
                          {data ? "No leaves here yet." : "Loading the canopy…"}
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="mt-4 text-[10px] text-muted-foreground">
                    Showing up to 500 recent leaves. Hidden leaves disappear
                    from public pages and connected displays.
                  </p>
                </section>
                <aside className="space-y-5">
                  <Card className="space-y-4">
                    <h2 className="text-xl">Prepare the demo</h2>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Load a varied canopy for rehearsal. Every sample is
                      visibly labelled.
                    </p>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={Boolean(busy)}
                      className="w-full"
                      onClick={() => action({ action: "seed" }, "seed")}
                    >
                      <Plus size={14} />
                      Load 24 demo leaves
                    </Button>
                    {confirmClear ? (
                      <div className="space-y-3 rounded-xl bg-muted p-4">
                        <p className="text-xs">
                          Remove all demo leaves? Visitor hopes will stay.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              action({ action: "clear_demo" }, "clear_demo")
                            }
                            disabled={Boolean(busy)}
                          >
                            Remove demos
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmClear(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={Boolean(busy) || !data?.stats.demo}
                        className="w-full"
                        onClick={() => setConfirmClear(true)}
                      >
                        <Trash2 size={14} />
                        Clear demo leaves
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={Boolean(busy)}
                      className="w-full"
                      onClick={() => action({ action: "reflect" }, "reflect")}
                    >
                      <Sparkles size={14} />
                      Update collective reflection
                    </Button>
                  </Card>
                  <Card>
                    <h2 className="mb-5 text-xl">Branches of hope</h2>
                    <div className="space-y-4">
                      {themes.map((theme) => (
                        <div key={theme.id}>
                          <div className="mb-1.5 flex justify-between text-[10px]">
                            <span>{theme.short}</span>
                            <span>{data?.stats.categories[theme.id] ?? 0}</span>
                          </div>
                          <div className="h-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                background: "var(--primary)",
                                width: `${Math.max(0, ((data?.stats.categories[theme.id] || 0) / Math.max(data?.stats.total || 1, 1)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                  <Card>
                    <h2 className="mb-4 text-xl">Service activity</h2>
                    <dl className="space-y-3 text-xs">
                      {[
                        ["Accepted", data?.metrics?.accepted || 0],
                        ["Rejected", data?.metrics?.rejected || 0],
                        [
                          "OpenAI interpretations",
                          data?.metrics?.ai_success || 0,
                        ],
                        ["Offline fallbacks", data?.metrics?.ai_fallback || 0],
                      ].map(([label, count]) => (
                        <div key={label} className="flex justify-between">
                          <dt className="text-muted-foreground">{label}</dt>
                          <dd>{count}</dd>
                        </div>
                      ))}
                    </dl>
                  </Card>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
