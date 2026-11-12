"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  Maximize,
  Minimize,
  ArrowUpRight,
  Sprout,
  X,
  Wind,
  Play,
  Pause,
  Plus,
  Minus,
  RotateCcw,
  Leaf as LeafIcon,
  MapPin,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { TreeCanvasProps } from "./tree-canvas";
const TreeCanvas = dynamic<TreeCanvasProps>(
  () => import("./tree-canvas").then((mod) => mod.TreeCanvas),
  { ssr: false },
);
import { themes, themeFor, chamberDetails, type Leaf } from "@/lib/catalog";
import { useTree } from "@/hooks/use-tree";
import { appUrl } from "@/lib/client";
import { displayMessage } from "@/lib/display-copy";
import { defaultTreeSettings, treePalettes } from "@/lib/tree-settings";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import type { SceneController } from "./tree-scene";

export function DisplayScreen() {
  const { tree, connection } = useTree({ cache: true });
  const scene = useRef<SceneController | null>(null);
  const [rotating, setRotating] = useState(true);
  const [arrivalIds, setArrivalIds] = useState<string[]>([]);
  const settings = tree?.settings || defaultTreeSettings;
  const presentation = useMemo(
    () => ({ ...settings, autoRotate: rotating }),
    [settings, rotating],
  );
  const [leaves, setLeaves] = useState<Leaf[]>([]),
    [featured, setFeatured] = useState<Leaf | null>(null),
    [selected, setSelected] = useState<Leaf | null>(null);
  const [joinUrl, setJoinUrl] = useState(""),
    [full, setFull] = useState(false),
    [pending, setPending] = useState(0),
    [lastArrival, setLastArrival] = useState(0),
    [showReflection, setShowReflection] = useState(false),
    [reflectionVisible, setReflectionVisible] = useState(false);
  const initialized = useRef(false),
    synced = useRef(false),
    seen = useRef(new Set<string>()),
    queue = useRef<Leaf[]>([]),
    available = useRef(new Set<string>()),
    flights = useRef(new Map<string, number>()),
    stories = useRef<Leaf[]>([]),
    lastStory = useRef(0);
  useEffect(() => {
    setTimeout(() => setJoinUrl(appUrl() + "/join"), 0);
    const changed = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  useEffect(() => {
    if (!tree) return;
    available.current = new Set(tree.leaves.map((leaf) => leaf.id));
    if (!initialized.current || (!synced.current && connection === "live")) {
      initialized.current = true;
      if (connection === "live") synced.current = true;
      seen.current.clear();
      queue.current = [];
      flights.current.clear();
      stories.current = [];
      setArrivalIds([]);
      setPending(0);
      tree.leaves.forEach((leaf) => seen.current.add(leaf.id));
      setLeaves(tree.leaves);
      setFeatured(tree.leaves[0] || null);
      return;
    }
    for (const id of seen.current) {
      if (!available.current.has(id)) seen.current.delete(id);
    }
    const incoming = tree.leaves
      .filter((leaf) => !seen.current.has(leaf.id))
      .reverse();
    incoming.forEach((leaf) => seen.current.add(leaf.id));
    queue.current = [
      ...queue.current.filter((leaf) => available.current.has(leaf.id)),
      ...incoming,
    ].slice(-120);
    setPending(queue.current.length);
    for (const id of flights.current.keys())
      if (!available.current.has(id)) flights.current.delete(id);
    setArrivalIds((previous) =>
      previous.filter((id) => available.current.has(id)),
    );
    setLeaves((previous) =>
      previous.filter((leaf) => available.current.has(leaf.id)),
    );
    setSelected((previous) =>
      previous && !available.current.has(previous.id) ? null : previous,
    );
    setFeatured((previous) =>
      previous && !available.current.has(previous.id) ? null : previous,
    );
  }, [tree, connection]);
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      for (const [id, expires] of flights.current)
        if (expires <= now || !available.current.has(id))
          flights.current.delete(id);
      const size = Math.min(
        8,
        Math.max(1, Math.ceil(queue.current.length / 4)),
      );
      const batch = queue.current
        .splice(0, size)
        .filter((leaf) => available.current.has(leaf.id));
      if (batch.length) {
        setPending(queue.current.length);
        const ids = new Set(batch.map((leaf) => leaf.id));
        setLeaves((previous) =>
          [
            ...batch.reverse(),
            ...previous.filter((leaf) => !ids.has(leaf.id)),
          ].slice(0, 120),
        );
        batch.forEach((leaf, index) =>
          flights.current.set(leaf.id, now + 2400 + index * 80),
        );
        stories.current = [...stories.current, ...batch].slice(-12);
        setLastArrival(now);
        setShowReflection(false);
      }
      const ids = [...flights.current.keys()];
      setArrivalIds((previous) =>
        previous.length === ids.length &&
          previous.every((id, i) => id === ids[i])
          ? previous
          : ids,
      );
      if (now - lastStory.current >= 4500) {
        let next = stories.current.shift();
        while (next && !available.current.has(next.id))
          next = stories.current.shift();
        if (next) {
          setFeatured(next);
          lastStory.current = now;
        }
      }
    }, 350);
    const reflectionTimer = setInterval(
      () => setShowReflection((value) => !value),
      18000,
    );
    return () => {
      clearInterval(interval);
      clearInterval(reflectionTimer);
    };
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      setReflectionVisible(
        Boolean(
          showReflection && tree?.reflection && !selected && Date.now() - lastArrival > 6500,
        ),
      );
    }, 1000);
    return () => clearInterval(id);
  }, [showReflection, tree?.reflection, selected, lastArrival]);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* Some embedded browsers do not support fullscreen. */ }
  }
  const active = selected || featured,
    reflection =
      showReflection &&
      tree?.reflection &&
      !selected &&
      reflectionVisible;
  const palette = treePalettes[settings.palette];
  const contentKey = reflection
    ? `reflection-${tree?.reflection?.body}`
    : active?.id || "first-hope";
  return (
    <MotionConfig reducedMotion="user">
      <div className="kiosk-shell" data-testid="kiosk-display" data-palette={settings.palette} style={{
        background: palette.background,
        color: settings.palette === "night" ? "#f5f8ee" : settings.palette === "frost" ? "#071d2e" : "#243c3a",
      }}>
        <TreeCanvas
          leaves={leaves}
          contributionCount={Math.max(0, (tree?.total || 0) - pending)}
          settings={presentation}
          activeId={active?.id}
          arrivalIds={arrivalIds}
          onSelect={setSelected}
          className="kiosk-tree"
          environment="garden"
          sceneRef={scene}
          showControls={false}
        />
        <main className="kiosk-screen">
          <motion.header
            className="kiosk-header"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <Link href="/" className="kiosk-brand">
              <Sprout strokeWidth={1.5} />
              <span>
                The living tree
                <span className="kiosk-brand-subtitle">Gelephu Mindfulness City</span>
              </span>
            </Link>
            <div className="kiosk-header-actions">
              <span className="kiosk-connection">
                <span className={connection === "live" ? "bg-[#55834d]" : "bg-amber-500"} />
                {connection === "live" ? "A living collection" : connection === "connecting" ? "Connecting" : "Reconnecting"}
              </span>
              <Link href="/tree" className="kiosk-studio-link" aria-label="Open interactive Tree Studio">
                Customize tree <ArrowUpRight size={13} />
              </Link>
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={toggleFullscreen}
                className="kiosk-fullscreen"
                aria-label={full ? "Exit fullscreen" : "Enter fullscreen"}
              >
                {full ? <Minimize size={18} /> : <Maximize size={18} />}
              </motion.button>
            </div>
          </motion.header>
          <motion.div
            className="kiosk-heading"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.15 }}
          >
            <h1 className="tracking-tight font-light">{settings.headline}</h1>
            <span>Every leaf is someone's hope. Find a story in the branches.</span>
          </motion.div>
          <div className="kiosk-arrivals" aria-hidden="true">
            <AnimatePresence>
              {arrivalIds.length > 0 && (
                <motion.div
                  key="arrival-wave"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                >
                  <span className="arrival-dots">
                    {arrivalIds.slice(0, 6).map((id) => (
                      <motion.i
                        key={id}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        style={{
                          background: themeFor(
                            leaves.find((leaf) => leaf.id === id)?.category || "nature",
                          ).color,
                        }}
                      />
                    ))}
                  </span>
                  <span>
                    {arrivalIds.length === 1 ? "A new hope is taking root" : `${arrivalIds.length} hopes are taking root together`}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <section className="kiosk-feature" aria-label="A hope from the tree" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={contentKey}
                initial={{ opacity: 0, y: 22, filter: "blur(5px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(3px)", transition: { duration: 0.18 } }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                {selected && (
                  <motion.button whileHover={{ rotate: 90 }} onClick={() => setSelected(null)} className="kiosk-close" aria-label="Close selected leaf">
                    <X size={17} />
                  </motion.button>
                )}
                <span className="kiosk-leaf-emblem" style={{ color: active ? themeFor(active.category).color : palette.leaves[0] }}>
                  <LeafIcon size={26} strokeWidth={1.2} />
                </span>
                <p className="kiosk-feature-label">
                  {reflection ? "A reflection from our branches" : active?.is_demo ? "Illustrative demo leaf" : selected ? themeFor(selected.category).label : active ? "A hope taking root" : "A little possibility"}
                </p>
                <blockquote>
                  {reflection ? displayMessage(tree!.reflection!.body) : active ? `“${displayMessage(active.leaf_message, 100)}”` : "Every future begins with a hope."}
                </blockquote>
                <p className="kiosk-leaf-code">
                  {active && !reflection ? `Leaf #${active.id.slice(0, 6)} · ${themeFor(active.category).short}` : "Scan to grow a new leaf."}
                </p>
                {active && !reflection && (
                  <p className="kiosk-chamber">
                    <MapPin size={13} /> Chamber {active.chamber_id} · {chamberDetails[active.chamber_id].short}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </section>
          <motion.section
            className="kiosk-qr-panel"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {joinUrl && (
              <Link href="/join" className="kiosk-qr" aria-label="Scan with your phone to add your hope">
                <QRCodeSVG value={joinUrl} size={220} marginSize={6} title="Scan with your phone to add your hope" />
              </Link>
            )}
            <div className="kiosk-qr-copy">
              <h2>{settings.acceptingContributions ? "Grow your leaf." : "A moment to reflect."}</h2>
              <p>{settings.acceptingContributions ? "Scan with your phone. Share a hope. Watch it grow." : "The tree is resting. Come back shortly."}</p>
              <span>{joinUrl.replace(/^https?:\/\//, "")}</span>
            </div>
          </motion.section>
          <div className="kiosk-legend" aria-label="Explore hopes by theme">
            {themes.map((theme) => (
              <motion.button
                key={theme.id}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                disabled={!leaves.some((leaf) => leaf.category === theme.id)}
                onClick={() => setSelected(leaves.find((leaf) => leaf.category === theme.id) || null)}
                aria-label={`Read a ${theme.short.toLowerCase()} hope`}
              >
                <i style={{ background: theme.color }} />
                {theme.short}
              </motion.button>
            ))}
          </div>
          <div className="kiosk-controls" aria-label="Tree controls">
            <span>Drag to explore · Scroll to zoom</span>
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.9 }} aria-label="Send a breeze through the tree" onClick={() => scene.current?.breeze()}>
              <Wind size={18} />
            </motion.button>
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.9 }} aria-label={rotating ? "Pause tree rotation" : "Resume tree rotation"} aria-pressed={!rotating} onClick={() => setRotating((value) => !value)}>
              {rotating ? <Pause size={17} /> : <Play size={17} />}
            </motion.button>
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.9 }} aria-label="Zoom in on tree" onClick={() => scene.current?.zoom(0.85)}>
              <Plus size={19} />
            </motion.button>
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.9 }} aria-label="Zoom out of tree" onClick={() => scene.current?.zoom(1.15)}>
              <Minus size={19} />
            </motion.button>
            <motion.button whileHover={{ y: -2 }} whileTap={{ scale: 0.9 }} aria-label="Reset tree view" onClick={() => scene.current?.resetView()}>
              <RotateCcw size={17} />
            </motion.button>
          </div>
          <footer className="kiosk-footer">
            <span className="kiosk-count">
              <strong>{tree?.total ?? 0}</strong> {tree?.total === 1 ? "hope" : "hopes"} taking root
            </span>
            <p role="status" className="kiosk-status">
              {connection === "reconnecting" ? "Connection paused. Keeping the tree while we reconnect." : pending ? `${pending} ${pending === 1 ? "leaf is" : "leaves are"} finding a branch…` : "Anonymous voices. Shared possibilities."}
              {Boolean(tree?.stats.demo) && <span>Includes {tree!.stats.demo} illustrative demo leaves.</span>}
            </p>
          </footer>
        </main>
      </div>
    </MotionConfig>
  );
}
