"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Plus, Minus, RotateCcw, Move3D } from "lucide-react";
import { TreeIllustration } from "./tree-illustration";
import { defaultTreeSettings, type TreeSettings } from "@/lib/tree-settings";
import { treeGrowth } from "@/lib/tree-growth";
import { themeFor, type Leaf } from "@/lib/catalog";
import type { SceneController, ProjectedLeaf } from "./tree-scene";
import type { GrowthMetrics } from "./tree-model";
export type TreeCanvasProps = {
  leaves?: Leaf[];
  activeId?: string;
  arrivalId?: string;
  arrivalIds?: readonly string[];
  onSelect?: (leaf: Leaf) => void;
  illustrative?: boolean;
  className?: string;
  settings?: TreeSettings;
  contributionCount?: number;
  sceneRef?: React.RefObject<SceneController | null>;
  showControls?: boolean;
  environment?: "transparent" | "garden";
};

export function TreeCanvas({
  leaves = [],
  activeId,
  arrivalId,
  arrivalIds = [],
  onSelect,
  illustrative = false,
  className = "",
  settings = defaultTreeSettings,
  contributionCount = leaves.length,
  sceneRef,
  showControls = true,
  environment = "transparent",
}: TreeCanvasProps) {
  const host = useRef<HTMLDivElement>(null),
    root = useRef<HTMLDivElement>(null),
    controller = useRef<SceneController | null>(null),
    markerElements = useRef(new Map<string, HTMLButtonElement>()),
    pointer = useRef({ x: 0, y: 0 });
  const latest = useRef({
    leaves,
    activeId,
    arrivalId,
    arrivalIds,
    settings,
    contributionCount,
  });
  const [state, setState] = useState<"loading" | "3d" | "illustration">(
      "loading",
    ),
    hint = useId(),
    appearance = JSON.stringify(settings);
  const growth = treeGrowth(contributionCount, settings);
  useEffect(() => {
    let cancelled = false,
      scene: SceneController | null = null;
    latest.current = { leaves, activeId, arrivalId, arrivalIds, settings, contributionCount };
    setTimeout(() => setState("loading"), 0);
    if (settings.renderer === "illustration") {
      setTimeout(() => setState("illustration"), 0);
      return;
    }
    const project = (items: ProjectedLeaf[], metrics?: GrowthMetrics) => {
      const projectedIds = new Set(items.map((item) => item.id));
      for (const [id, button] of markerElements.current)
        if (!projectedIds.has(id)) button.style.visibility = "hidden";
      for (const item of items) {
        const button = markerElements.current.get(item.id);
        if (button) {
          button.style.transform = `translate(${item.x}px,${item.y}px) translate(-50%,-50%)`;
          button.style.visibility = item.visible ? "visible" : "hidden";
        }
      }
      if (metrics && root.current) {
        root.current.dataset.foliageCount = String(metrics.foliage);
        root.current.dataset.branchCount = String(metrics.branches);
        root.current.dataset.growthProgress = metrics.progress.toFixed(4);
        root.current.dataset.growthPhase = metrics.phase;
        root.current.dataset.growthScale = metrics.scale.toFixed(4);
        root.current.dataset.activeArrivals = String(metrics.arriving);
      }
    };
    void import("./tree-scene")
      .then(({ createTreeScene }) => {
        if (cancelled || !host.current) return;
        try {
          scene = createTreeScene(
            host.current,
            latest.current.settings,
            project,
            () => {
              scene?.dispose();
              controller.current = null;
              if (sceneRef) sceneRef.current = null;
              if (!cancelled) setState("illustration");
            },
            environment,
          );
          controller.current = scene;
          if (sceneRef) sceneRef.current = scene;
          scene.update(
            latest.current.leaves,
            latest.current.activeId,
            latest.current.arrivalId,
            latest.current.contributionCount,
            latest.current.arrivalIds,
          );
          setState("3d");
        } catch {
          setState("illustration");
        }
      })
      .catch(() => {
        if (!cancelled) setState("illustration");
      });
    return () => {
      cancelled = true;
      scene?.dispose();
      controller.current = null;
      if (sceneRef) sceneRef.current = null;
    };
    // Renderer changes need a new context; other edits update the existing scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.renderer, environment]);
  useEffect(() => {
    try {
      controller.current?.configure(settings);
    } catch {
      controller.current?.dispose();
      controller.current = null;
      setTimeout(() => setState("illustration"), 0);
    }
  }, [appearance]);
  useEffect(() => {
    controller.current?.update(
      leaves,
      activeId,
      arrivalId,
      contributionCount,
      arrivalIds,
    );
  }, [leaves, activeId, arrivalId, arrivalIds, contributionCount, state]);
  return (
    <div
      ref={root}
      className={`procedural-tree ${className}`}
      data-renderer={state}
      data-species={settings.species}
      data-environment={environment}
      data-contributions={contributionCount}
      data-foliage-count={
        state === "3d"
          ? undefined
          : settings.growthMode === "contributions"
            ? contributionCount
            : 220
      }
      data-growth-phase={state === "3d" ? undefined : growth.phase}
      role="group"
      aria-label="GM Tree"
    >
      <div
        ref={host}
        className="procedural-host"
        tabIndex={0}
        aria-label="Interactive tree: drag to orbit, scroll or pinch to zoom"
        aria-describedby={hint}
        onPointerDown={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY };
        }}
        onKeyDown={(event) => {
          const scene = controller.current;
          if (!scene) return;
          const commands: Record<string, () => void> = {
            ArrowLeft: () => scene.orbit(-0.15),
            ArrowRight: () => scene.orbit(0.15),
            ArrowUp: () => scene.orbit(0, -0.1),
            ArrowDown: () => scene.orbit(0, 0.1),
            "+": () => scene.zoom(0.85),
            "=": () => scene.zoom(0.85),
            "-": () => scene.zoom(1.15),
            Home: () => scene.resetView(),
          };
          if (commands[event.key]) {
            event.preventDefault();
            commands[event.key]();
          }
        }}
      />
      {state !== "3d" && (
        <div className="tree-fallback">
          <TreeIllustration
            leaves={leaves}
            activeId={activeId}
            arrivalId={arrivalId}
            arrivalIds={arrivalIds}
            onSelect={onSelect}
            illustrative={illustrative}
            count={contributionCount}
            settings={settings}
          />
        </div>
      )}
      {state === "3d" && onSelect && (
        <div className="tree-marker-layer">
          {leaves.map((leaf) => (
            <button
              key={leaf.id}
              type="button"
              data-leaf-id={leaf.id}
              className={`tree-leaf tree-marker ${activeId === leaf.id ? "is-featured" : ""} ${arrivalIds.includes(leaf.id) ? "is-arriving" : ""}`}
              ref={(element) => {
                if (element) markerElements.current.set(leaf.id, element);
                else markerElements.current.delete(leaf.id);
              }}
              aria-label={`${themeFor(leaf.category).short}: ${leaf.leaf_message} · Leaf #${leaf.id.slice(0, 6)}`}
              onClick={(event) => {
                if (
                  event.detail === 0 ||
                  Math.hypot(
                    event.clientX - pointer.current.x,
                    event.clientY - pointer.current.y,
                  ) < 8
                )
                  onSelect(leaf);
              }}
              onPointerDown={(event) => {
                pointer.current = { x: event.clientX, y: event.clientY };
              }}
              style={
                {
                  "--leaf-color": themeFor(leaf.category).color,
                } as React.CSSProperties
              }
            >
              <span className="sr-only">{leaf.leaf_message}</span>
            </button>
          ))}
        </div>
      )}
      <span id={hint} className="sr-only">
        Drag to rotate the tree. Scroll or pinch to zoom. Use arrow keys, plus,
        minus, or Home when the tree is focused.
      </span>
      {state === "3d" && showControls && (
        <div className="tree-camera-controls">
          <span>
            <Move3D size={13} />
            Drag to orbit · Pinch to zoom
          </span>
          <button
            aria-label="Zoom in on tree"
            onClick={() => controller.current?.zoom(0.85)}
          >
            <Plus size={16} />
          </button>
          <button
            aria-label="Zoom out of tree"
            onClick={() => controller.current?.zoom(1.15)}
          >
            <Minus size={16} />
          </button>
          <button
            aria-label="Reset tree view"
            onClick={() => controller.current?.resetView()}
          >
            <RotateCcw size={15} />
          </button>
        </div>
      )}
      {state === "illustration" && (
        <span className="renderer-note">Illustrated display</span>
      )}
    </div>
  );
}

export default TreeCanvas;
