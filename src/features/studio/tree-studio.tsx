"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  PanelRightClose,
  PanelRightOpen,
  Shuffle,
  Save,
  Download,
  Upload,
  ImageDown,
  Box,
  Sprout,
  RotateCcw,
  Minus,
  Plus,
  LoaderCircle,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { TreeCanvasProps } from "@/features/display/tree-canvas";
const TreeCanvas = dynamic<TreeCanvasProps>(
  () => import("@/features/display/tree-canvas").then((mod) => mod.TreeCanvas),
  { ssr: false },
);
import type { SceneController } from "@/features/display/tree-scene";
import { TreeControls } from "./tree-controls";
import {
  defaultTreeSettings,
  treeSettingsSchema,
  type TreeSettings,
} from "@/lib/tree-settings";
import { treeGrowth } from "@/lib/tree-growth";
import { useTree } from "@/hooks/use-tree";
import { api } from "@/lib/client";

const species = [
  ["oak", "Oak"],
  ["pine", "Pine"],
  ["cypress", "Cypress"],
  ["willow", "Willow"],
  ["bush", "Bush"],
  ["spooky", "Spooky"],
] as const;
const palettes = [
  ["blossom", "Blossom", "#e2aabd"],
  ["spring", "Spring", "#99b86f"],
  ["autumn", "Autumn", "#cf954e"],
  ["frost", "Frost", "#b1d5da"],
  ["night", "Night", "#477e76"],
] as const;
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function TreeStudio() {
  const { tree, connection } = useTree(),
    [settings, setSettings] = useState(defaultTreeSettings),
    [preview, setPreview] = useState(defaultTreeSettings),
    [showPanel, setShowPanel] = useState(true),
    [authenticated, setAuthenticated] = useState(false),
    [countOverride, setCountOverride] = useState<number | null>(null),
    [busy, setBusy] = useState(""),
    [notice, setNotice] = useState("");
  const scene = useRef<SceneController | null>(null),
    loaded = useRef(false),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (tree && !loaded.current) {
      loaded.current = true;
      setSettings(tree.settings || defaultTreeSettings);
      setPreview(tree.settings || defaultTreeSettings);
    }
  }, [tree]);
  useEffect(() => {
    api<{ authenticated: boolean }>("/api/admin/session")
      .then((data) => setAuthenticated(data.authenticated))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setPreview(settings), 180);
    return () => clearTimeout(timer);
  }, [settings]);
  const count = countOverride ?? tree?.total ?? 0,
    liveCount = tree?.total ?? 0,
    growth = treeGrowth(count, preview),
    manual = settings.growthMode === "manual";
  const visibleLeaves =
    count === 0
      ? []
      : countOverride === null
        ? tree?.leaves || []
        : (tree?.leaves || []).slice(-Math.min(count, 120));
  useEffect(() => {
    if (innerWidth < 900) setTimeout(() => setShowPanel(false), 0);
  }, []);
  function chooseSpecies(index: number) {
    const next = species[(index + species.length) % species.length][0];
    setSettings((value) => ({
      ...value,
      species: next,
      palette: next === "spooky" ? "night" : value.palette,
      leafShape:
        next === "pine" || next === "cypress" ? "needle" : value.leafShape,
    }));
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("input,textarea,select,button,[contenteditable=true]") ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (event.key.toLowerCase() === "h") {
        event.preventDefault();
        setShowPanel((value) => !value);
      }
      if (event.code === "Space") {
        event.preventDefault();
        setSettings((value) => ({
          ...value,
          seed: Math.floor(Math.random() * 999998) + 1,
        }));
      }
      if (event.key === "Escape") setShowPanel(false);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  async function publish() {
    setBusy("save");
    setNotice("");
    try {
      await api("/api/admin/tree", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setNotice("Saved to reception. Preview counts were not published.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not save the tree.",
      );
    } finally {
      setBusy("");
    }
  }
  async function exportAsset(format: "png" | "glb") {
    if (!scene.current) {
      setNotice(
        "3D export is available when the interactive renderer is ready.",
      );
      return;
    }
    setBusy(format);
    setNotice("");
    try {
      const blob =
        format === "png"
          ? await scene.current.capture()
          : new Blob([await scene.current.exportGlb()], {
              type: "model/gltf-binary",
            });
      saveFile(blob, `${settings.species}-${settings.seed}.${format}`);
      setNotice(
        format === "png" ? "Tree image downloaded." : "Tree model downloaded.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy("");
    }
  }
  async function importConfig(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 16000)
        throw new Error(
          "Choose a tree settings file smaller than 16 kilobytes.",
        );
      const data = JSON.parse(await file.text()),
        parsed = treeSettingsSchema.safeParse(data.settings || data);
      if (!parsed.success)
        throw new Error("This file does not contain valid tree settings.");
      setSettings(parsed.data);
      setNotice(
        "Configuration loaded for preview. Save to reception to apply it.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not read settings.",
      );
    } finally {
      if (input.current) input.current.value = "";
    }
  }
  return (
    <main
      className={`tree-studio ${showPanel ? "panel-open" : ""}`}
      data-testid="tree-studio"
    >
      <header className="studio-header">
        <Link href="/display" className="studio-back">
          <ArrowLeft size={16} />
          <span>GM Tree</span>
        </Link>
        <div className="studio-palettes" aria-label="Tree palettes">
          {palettes.map(([id, label, color]) => (
            <button
              key={id}
              onClick={() =>
                setSettings((value) => ({
                  ...value,
                  palette: id,
                  customColors: false,
                }))
              }
              aria-pressed={settings.palette === id}
              title={label}
            >
              <i style={{ background: color }} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          className="studio-icon"
          aria-label={
            showPanel ? "Hide customization panel" : "Show customization panel"
          }
          onClick={() => setShowPanel((value) => !value)}
        >
          {showPanel ? (
            <PanelRightClose size={20} />
          ) : (
            <PanelRightOpen size={20} />
          )}
        </button>
      </header>
      <nav className="studio-species" aria-label="Tree species">
        {species.map(([id, label], index) => (
          <button
            key={id}
            aria-pressed={settings.species === id}
            onClick={() => chooseSpecies(index)}
          >
            <Sprout size={23} strokeWidth={id === "spooky" ? 0.9 : 1.5} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <section className="studio-view" aria-label="Interactive tree workshop">
        <TreeCanvas
          leaves={visibleLeaves}
          contributionCount={count}
          settings={preview}
          className="studio-canvas"
          sceneRef={scene}
        />
        <div className="studio-caption">
          <p>
            {countOverride === null && !manual
              ? "The live reception tree"
              : "Preview only"}
          </p>
          <h1>
            {settings.species[0].toUpperCase() + settings.species.slice(1)} ·{" "}
            {manual ? "manual age" : growth.phase}
          </h1>
          <span>
            {count} {count === 1 ? "hope" : "hopes"} · Seed {settings.seed} ·{" "}
            {connection === "live" ? "Connected" : "Reconnecting"}
          </span>
        </div>
      </section>
      <aside className="studio-panel" aria-label="Tree customization">
        <div className="studio-panel-title">
          <div>
            <p>Gelephu Tree Studio</p>
            <h2>Make it your own.</h2>
          </div>
          <button
            aria-label="Close customization panel"
            className="studio-icon"
            onClick={() => setShowPanel(false)}
          >
            <PanelRightClose size={18} />
          </button>
        </div>
        <div className="studio-preview-count">
          <div>
            <label htmlFor="preview-count">Growth preview</label>
            <button
              onClick={() => {
                setCountOverride(null);
                setSettings((value) => ({
                  ...value,
                  growthMode: "contributions",
                }));
              }}
            >
              Use live count ({liveCount})
            </button>
          </div>
          <input
            id="preview-count"
            aria-label="Preview contribution count"
            type="range"
            min={0}
            max={Math.max(200, liveCount)}
            step={1}
            value={count}
            onChange={(event) => {
              setCountOverride(Number(event.target.value));
              setSettings((value) => ({
                ...value,
                growthMode: "contributions",
              }));
            }}
          />
          <div className="studio-preview-stages">
            {[0, 1, 8, 24, 48, 120].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setCountOverride(n);
                  setSettings((value) => ({
                    ...value,
                    growthMode: "contributions",
                  }));
                }}
              >
                {n === 0 ? "Bare" : n}
              </button>
            ))}
          </div>
          <span>
            {countOverride === null
              ? "Live visitor count. New approved hopes grow this tree."
              : `${count} simulated hopes. No database records are created.`}
          </span>
        </div>
        <TreeControls settings={settings} onChange={setSettings} />
        <div className="studio-publish">
          {authenticated ? (
            <button
              className="studio-save"
              disabled={Boolean(busy)}
              onClick={publish}
            >
              {busy === "save" ? (
                <LoaderCircle size={16} className="orbit" />
              ) : (
                <Save size={16} />
              )}
              Save to reception
            </button>
          ) : (
            <Link href="/admin" className="studio-save">
              Sign in as staff to save
            </Link>
          )}
          <p role="status">{notice}</p>
        </div>
      </aside>
      <footer className="studio-bottom">
        <button
          aria-label="New tree seed"
          onClick={() =>
            setSettings((value) => ({
              ...value,
              seed: Math.floor(Math.random() * 999998) + 1,
            }))
          }
        >
          <Shuffle size={16} />
          <span>New seed</span>
        </button>
        <button
          aria-label="Reset studio view"
          onClick={() => scene.current?.resetView()}
        >
          <RotateCcw size={16} />
          <span>Reset view</span>
        </button>
        <div className="studio-export">
          <button
            aria-label="Download tree image"
            disabled={Boolean(busy)}
            onClick={() => exportAsset("png")}
          >
            <ImageDown size={16} />
            <span>Image</span>
          </button>
          <button
            aria-label="Download tree model"
            disabled={Boolean(busy)}
            onClick={() => exportAsset("glb")}
          >
            <Box size={16} />
            <span>3D model</span>
          </button>
          <button
            aria-label="Download tree configuration"
            onClick={() =>
              saveFile(
                new Blob([JSON.stringify({ version: 1, settings }, null, 2)], {
                  type: "application/json",
                }),
                `gmc-tree-${settings.seed}.json`,
              )
            }
          >
            <Download size={16} />
            <span>Config</span>
          </button>
          <button
            aria-label="Import tree configuration file"
            onClick={() => input.current?.click()}
          >
            <Upload size={16} />
            <span>Import</span>
          </button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import tree configuration"
            onChange={(event) => importConfig(event.target.files?.[0])}
          />
        </div>
        <span className="studio-credit">Tree geometry by Mike Fernandez</span>
      </footer>
      {!showPanel && notice && (
        <p className="studio-toast" role="status">
          {notice}
        </p>
      )}
    </main>
  );
}
