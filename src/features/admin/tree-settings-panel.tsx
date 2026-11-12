"use client";
import { useEffect, useState } from "react";
import {
  Save,
  RotateCcw,
  Shuffle,
  LoaderCircle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { TreeCanvasProps } from "@/features/display/tree-canvas";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
const TreeCanvas = dynamic<TreeCanvasProps>(
  () => import("@/features/display/tree-canvas").then((mod) => mod.TreeCanvas),
  { ssr: false },
);
import { defaultTreeSettings, type TreeSettings } from "@/lib/tree-settings";
import type { Leaf } from "@/lib/catalog";
import { api } from "@/lib/client";
export function TreeSettingsPanel({ leaves }: { leaves: Leaf[] }) {
  const [settings, setSettings] = useState<TreeSettings>(defaultTreeSettings),
    [preview, setPreview] = useState(defaultTreeSettings);
  const [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let alive = true;
    api<{ settings: TreeSettings }>("/api/admin/tree")
      .then((data) => {
        if (alive) {
          setSettings(data.settings);
          setPreview(data.settings);
          setLoaded(true);
        }
      })
      .catch((error) => {
        if (alive) setNotice(error.message);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setPreview(settings), 400);
    return () => clearTimeout(timer);
  }, [settings]);
  function change<K extends keyof TreeSettings>(
    key: K,
    value: TreeSettings[K],
  ) {
    setSettings((previous) => ({ ...previous, [key]: value }));
    setNotice("");
  }
  async function save(titleOnly = false) {
    setBusy(true);
    setNotice("");
    try {
      await api("/api/admin/tree", {
        method: titleOnly ? "PATCH" : "PUT",
        body: JSON.stringify(
          titleOnly ? { headline: settings.headline } : settings,
        ),
      });
      setNotice(
        "Tree settings saved. Connected displays will update automatically.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not save settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby="tree-settings-title"
      className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
    >
      <Card>
        <h2 id="tree-settings-title" className="mb-2 text-2xl">
          Shape the living tree
        </h2>
        <p className="mb-7 text-sm text-muted-foreground">
          Preview a new appearance, then save to update the reception display.
        </p>
        <Button asChild variant="secondary" className="mb-6 w-full">
          <Link href="/tree">
            Open full-screen Tree Studio <ExternalLink size={15} />
          </Link>
        </Button>
        <fieldset disabled={!loaded || busy} className="space-y-6">
          <section className="rounded-xl border border-border bg-muted/60 p-5">
            <h3 className="text-base font-semibold">Display title</h3>
            <p className="mb-4 mt-2 text-xs leading-5 text-muted-foreground">
              Change the title shown above the reception tree. Connected
              displays update automatically.
            </p>
            <label className="block text-xs">
              <span>Title on the screen</span>
              <input
                aria-label="Display headline"
                value={settings.headline}
                maxLength={90}
                className="admin-select mt-2"
                onChange={(event) => change("headline", event.target.value)}
              />
            </label>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-[10px] text-muted-foreground">
                {settings.headline.length} / 90
              </span>
              <Button
                size="sm"
                disabled={!settings.headline.trim() || busy}
                onClick={() => void save(true)}
              >
                Save display title <Save size={14} />
              </Button>
            </div>
          </section>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-xs">
              <span className="block">Tree species</span>
              <select
                aria-label="Tree species"
                className="admin-select"
                value={settings.species}
                onChange={(event) =>
                  change(
                    "species",
                    event.target.value as TreeSettings["species"],
                  )
                }
              >
                {["oak", "pine", "willow", "cypress", "bush", "spooky"].map(
                  (name) => (
                    <option key={name} value={name}>
                      {name[0].toUpperCase() + name.slice(1)}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="space-y-2 text-xs">
              <span className="block">Canopy palette</span>
              <select
                aria-label="Canopy palette"
                className="admin-select"
                value={settings.palette}
                onChange={(event) =>
                  change(
                    "palette",
                    event.target.value as TreeSettings["palette"],
                  )
                }
              >
                {["spring", "blossom", "autumn", "night", "frost"].map(
                  (name) => (
                    <option key={name} value={name}>
                      {name[0].toUpperCase() + name.slice(1)}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-xs">
            <span>Growth driver</span>
            <select
              aria-label="Growth driver"
              className="admin-select"
              value={settings.growthMode}
              onChange={(event) =>
                change(
                  "growthMode",
                  event.target.value as TreeSettings["growthMode"],
                )
              }
            >
              <option value="contributions">
                Grow with approved visitor hopes
              </option>
              <option value="manual">Manual age and full-canopy preview</option>
            </select>
          </label>
          {settings.growthMode === "contributions" && (
            <label className="block space-y-2 text-xs">
              <span>Leaves to maturity</span>
              <input
                aria-label="Leaves to maturity"
                type="number"
                min={8}
                max={500}
                value={settings.leavesForMaturity}
                className="admin-select"
                onChange={(event) =>
                  change(
                    "leavesForMaturity",
                    Math.min(500, Math.max(8, Number(event.target.value) || 8)),
                  )
                }
              />
              <span className="block text-muted-foreground">
                An empty tree starts as a bare sapling. Each approved hope grows
                its branches.
              </span>
            </label>
          )}
          {(
            [
              ["age", "Tree maturity", 0.3, 1, 0.01],
              ["density", "Canopy density", 0.5, 1.6, 0.05],
              ["wind", "Breeze strength", 0, 1, 0.05],
              ["rotation", "Viewing angle", 0, 360, 5],
            ] as const
          )
            .filter(
              ([key]) =>
                settings.growthMode === "manual" ||
                (key !== "age" && key !== "density"),
            )
            .map(([key, label, min, max, step]) => (
              <label key={key} className="block space-y-3 text-xs">
                <span className="flex justify-between">
                  <span>{label}</span>
                  <span className="text-muted-foreground">
                    {key === "rotation"
                      ? `${settings[key]} degrees`
                      : settings[key].toFixed(2)}
                  </span>
                </span>
                <input
                  aria-label={label}
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={settings[key]}
                  onChange={(event) => change(key, Number(event.target.value))}
                  className="w-full accent-primary"
                />
              </label>
            ))}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="space-y-2 text-xs">
              <span className="block">Tree seed</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  max={999999}
                  aria-label="Tree seed"
                  value={settings.seed}
                  onChange={(event) =>
                    change(
                      "seed",
                      Math.max(
                        1,
                        Math.min(999999, Number(event.target.value) || 1),
                      ),
                    )
                  }
                  className="admin-select min-w-0"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Pick a new tree seed"
                  onClick={() =>
                    change("seed", Math.floor(Math.random() * 999998) + 1)
                  }
                >
                  <Shuffle size={15} />
                </Button>
              </div>
            </label>
            <label className="space-y-2 text-xs">
              <span className="block">Rendering quality</span>
              <select
                aria-label="Rendering quality"
                className="admin-select"
                value={settings.quality}
                onChange={(event) =>
                  change(
                    "quality",
                    event.target.value as TreeSettings["quality"],
                  )
                }
              >
                <option value="auto">Automatic (recommended)</option>
                <option value="low">Low · older displays</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-xs">
            <span>Tree renderer</span>
            <select
              aria-label="Tree renderer"
              className="admin-select"
              value={settings.renderer}
              onChange={(event) =>
                change(
                  "renderer",
                  event.target.value as TreeSettings["renderer"],
                )
              }
            >
              <option value="auto">
                3D with automatic illustration fallback
              </option>
              <option value="illustration">
                Illustration · widest compatibility
              </option>
            </select>
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/60 p-4 text-xs leading-relaxed">
            <input
              type="checkbox"
              checked={settings.acceptingContributions}
              onChange={(event) =>
                change("acceptingContributions", event.target.checked)
              }
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span>
              <strong className="block font-medium">
                Accept visitor hopes
              </strong>
              Turn off to pause new submissions. Existing leaves and retry
              receipts stay available.
            </span>
          </label>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void save()}>
              {busy ? (
                <LoaderCircle size={15} className="orbit" />
              ) : (
                <Save size={15} />
              )}
              Save tree settings
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setSettings(defaultTreeSettings);
                setNotice("Defaults are previewed. Save to apply them.");
              }}
            >
              <RotateCcw size={15} />
              Preview defaults
            </Button>
          </div>
        </fieldset>
        <p role="status" className="mt-4 text-xs leading-relaxed text-muted-foreground">
          {notice}
        </p>
      </Card>
      <aside className="space-y-5">
        <div className="forest overflow-hidden rounded-2xl border border-border p-4">
          <p className="eyebrow p-3 text-center text-primary">
            Appearance preview
          </p>
          <TreeCanvas
            leaves={leaves
              .filter(
                (leaf) => !("status" in leaf) || leaf.status === "approved",
              )
              .slice(0, 24)}
            settings={preview}
            className="admin-tree-preview"
          />
          <p className="mb-4 text-center text-[10px] text-muted-foreground">
            A preview only until you save.
          </p>
        </div>
        <Card>
          <h3 className="mb-3 text-base font-semibold">Display-ready layout</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The display fills the viewport in portrait or landscape, reframes
            the whole tree, and keeps the scan code clear of the canopy. Set the
            screen to portrait in its display settings and enter browser
            fullscreen.
          </p>
          <Button asChild variant="secondary" className="mt-5 w-full">
            <Link href="/display" target="_blank">
              Open reception display <ExternalLink size={14} />
            </Link>
          </Button>
          <p className="mt-4 text-[10px] text-muted-foreground">
            Procedural branches adapted from Mike Fernandez's just-a-simple-tree
            (MIT). Visitor leaves remain linked to your local database.
          </p>
        </Card>
      </aside>
    </section>
  );
}
